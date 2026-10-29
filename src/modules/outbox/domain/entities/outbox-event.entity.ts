import { randomUUID } from 'node:crypto';

export type OutboxStatus = 'PENDIENTE' | 'EN_PROCESO' | 'PUBLICADO' | 'ERROR_FATAL';

export interface OutboxEventProps {
  id: string;
  eventId: string;
  aggregateId: string;
  aggregateType: string;
  eventType: string;
  exchange: string;
  routingKey: string;
  payload: Record<string, unknown>;
  status: OutboxStatus;
  attempts: number;
  maxAttempts: number;
  nextRetryAt: Date;
  lockedUntil: Date | null;
  workerId: string | null;
  publishedAt: Date | null;
  lastError: string | null;
  creadoEn: Date;
  actualizadoEn: Date;
}

export interface CrearOutboxEventParams {
  aggregateId: string;
  aggregateType?: string;
  eventType?: string;
  exchange?: string;
  routingKey?: string;
  payload: Record<string, unknown>;
  maxAttempts?: number;
  ahora?: Date;
}

/**
 * Entidad de dominio que modela un evento en el Transactional Outbox.
 *
 * Satisface los principios de entrega confiable (at-least-once):
 * - Identificador único y estable (eventId).
 * - Claim atómico con lease y protección contra trabajadores caídos o desfasados (fencing).
 * - Backoff exponencial con cálculo de reintentos determinista.
 * - Preservación permanente ante errores fatales para auditoría y recuperación supervisada.
 */
export class OutboxEvent {
  private readonly _id: string;
  private readonly _eventId: string;
  private readonly _aggregateId: string;
  private readonly _aggregateType: string;
  private readonly _eventType: string;
  private readonly _exchange: string;
  private readonly _routingKey: string;
  private readonly _payload: Record<string, unknown>;
  private _status: OutboxStatus;
  private _attempts: number;
  private readonly _maxAttempts: number;
  private _nextRetryAt: Date;
  private _lockedUntil: Date | null;
  private _workerId: string | null;
  private _publishedAt: Date | null;
  private _lastError: string | null;
  private readonly _creadoEn: Date;
  private _actualizadoEn: Date;

  private constructor(props: OutboxEventProps) {
    this._id = props.id;
    this._eventId = props.eventId;
    this._aggregateId = props.aggregateId;
    this._aggregateType = props.aggregateType;
    this._eventType = props.eventType;
    this._exchange = props.exchange;
    this._routingKey = props.routingKey;
    this._payload = { ...props.payload };
    this._status = props.status;
    this._attempts = props.attempts;
    this._maxAttempts = props.maxAttempts;
    this._nextRetryAt = new Date(props.nextRetryAt.getTime());
    this._lockedUntil = props.lockedUntil ? new Date(props.lockedUntil.getTime()) : null;
    this._workerId = props.workerId;
    this._publishedAt = props.publishedAt ? new Date(props.publishedAt.getTime()) : null;
    this._lastError = props.lastError;
    this._creadoEn = new Date(props.creadoEn.getTime());
    this._actualizadoEn = new Date(props.actualizadoEn.getTime());
  }

  static crear(params: CrearOutboxEventParams): OutboxEvent {
    return this.crearParaConsulta(params);
  }

  static crearParaConsulta(params: CrearOutboxEventParams): OutboxEvent {
    const ahora = params.ahora ?? new Date();
    const eventId = randomUUID();

    return new OutboxEvent({
      id: randomUUID(),
      eventId,
      aggregateId: params.aggregateId,
      aggregateType: params.aggregateType ?? 'ConsultaOdontologica',
      eventType: params.eventType ?? 'clinica.consulta.finalizada',
      exchange: params.exchange ?? 'dental.topic.exchange',
      routingKey: params.routingKey ?? 'clinica.consulta.finalizada',
      payload: { ...params.payload, eventId },
      status: 'PENDIENTE',
      attempts: 0,
      maxAttempts: params.maxAttempts ?? 5,
      nextRetryAt: ahora,
      lockedUntil: null,
      workerId: null,
      publishedAt: null,
      lastError: null,
      creadoEn: ahora,
      actualizadoEn: ahora,
    });
  }

  static reconstituir(props: OutboxEventProps): OutboxEvent {
    return new OutboxEvent(props);
  }

  /**
   * Reclama el evento para su publicación por un worker específico (Claim con Lease).
   */
  reclamar(workerId: string, leaseDurationMs: number, ahora: Date = new Date()): void {
    if (this._status === 'PUBLICADO') {
      throw new Error(`El evento ${this._id} ya ha sido publicado previamente.`);
    }

    if (this._status === 'ERROR_FATAL') {
      throw new Error(
        `El evento ${this._id} se encuentra en ERROR_FATAL y requiere recuperación supervisada.`,
      );
    }

    if (this._lockedUntil && this._lockedUntil.getTime() > ahora.getTime() && this._workerId !== workerId) {
      throw new Error(
        `El evento ${this._id} está bloqueado por el trabajador '${this._workerId}' hasta ${this._lockedUntil.toISOString()}.`,
      );
    }

    this._status = 'EN_PROCESO';
    this._workerId = workerId;
    this._lockedUntil = new Date(ahora.getTime() + leaseDurationMs);
    this._actualizadoEn = ahora;
  }

  /**
   * Sella el evento como PUBLICADO tras recibir ACK confirmado del broker RabbitMQ.
   * Valida la identidad del worker (Fencing) para evitar publicaciones fantasma.
   */
  marcarPublicado(workerId: string, ahora: Date = new Date()): void {
    if (this._status === 'PUBLICADO') {
      return;
    }

    if (this._workerId !== workerId) {
      throw new Error(
        `Violación de lease: el trabajador '${workerId}' intentó confirmar el evento ${this._id} que pertenece a '${this._workerId}'.`,
      );
    }

    this._status = 'PUBLICADO';
    this._publishedAt = ahora;
    this._lockedUntil = null;
    this._actualizadoEn = ahora;
  }

  /**
   * Registra un fallo de publicación (NACK, timeout, desconexión) y calcula el backoff exponencial.
   */
  registrarFallo(
    workerId: string,
    errorMensaje: string,
    ahora: Date = new Date(),
    maxIntentos?: number,
  ): void {
    if (this._status === 'PUBLICADO') {
      return;
    }

    if (this._workerId !== null && this._workerId !== workerId) {
      throw new Error(
        `Violación de lease: el trabajador '${workerId}' no posee el lock del evento ${this._id}.`,
      );
    }

    this._attempts += 1;
    this._lastError = errorMensaje.slice(0, 1000);
    this._lockedUntil = null;
    this._workerId = null;
    this._actualizadoEn = ahora;

    const limiteIntentos = maxIntentos ?? this._maxAttempts;
    if (this._attempts >= limiteIntentos) {
      this._status = 'ERROR_FATAL';
      // No programar más reintentos automáticos
      this._nextRetryAt = new Date(ahora.getTime() + 365 * 24 * 60 * 60 * 1000);
    } else {
      this._status = 'PENDIENTE';
      // Backoff exponencial: 2^attempts * 1000ms + jitter aleatorio (0-500ms)
      const baseDelayMs = Math.pow(2, this._attempts) * 1000;
      const jitterMs = Math.floor(Math.random() * 500);
      this._nextRetryAt = new Date(ahora.getTime() + baseDelayMs + jitterMs);
    }
  }

  /**
   * Procedimiento de rescate administrativo / supervisado para eventos en ERROR_FATAL.
   */
  recuperacionSupervisada(motivo: string, ahora: Date = new Date()): void {
    this._status = 'PENDIENTE';
    this._attempts = 0;
    this._lockedUntil = null;
    this._workerId = null;
    this._nextRetryAt = ahora;
    this._lastError = `[Recuperación supervisada: ${motivo.slice(0, 200)}]`;
    this._actualizadoEn = ahora;
  }

  // ─── Getters Inmutables ─────────────────────────────────────────────────────

  get id(): string {
    return this._id;
  }

  get eventId(): string {
    return this._eventId;
  }

  get aggregateId(): string {
    return this._aggregateId;
  }

  get aggregateType(): string {
    return this._aggregateType;
  }

  get eventType(): string {
    return this._eventType;
  }

  get exchange(): string {
    return this._exchange;
  }

  get routingKey(): string {
    return this._routingKey;
  }

  get payload(): Readonly<Record<string, unknown>> {
    return Object.freeze({ ...this._payload });
  }

  get status(): OutboxStatus {
    return this._status;
  }

  get attempts(): number {
    return this._attempts;
  }

  get maxAttempts(): number {
    return this._maxAttempts;
  }

  get nextRetryAt(): Date {
    return new Date(this._nextRetryAt.getTime());
  }

  get lockedUntil(): Date | null {
    return this._lockedUntil ? new Date(this._lockedUntil.getTime()) : null;
  }

  get workerId(): string | null {
    return this._workerId;
  }

  get publishedAt(): Date | null {
    return this._publishedAt ? new Date(this._publishedAt.getTime()) : null;
  }

  get lastError(): string | null {
    return this._lastError;
  }

  get creadoEn(): Date {
    return new Date(this._creadoEn.getTime());
  }

  get actualizadoEn(): Date {
    return new Date(this._actualizadoEn.getTime());
  }
}
