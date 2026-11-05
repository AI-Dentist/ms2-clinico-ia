import { ConsultaId } from '../value-objects/consulta-id.vo.js';
import { HistoriaClinicaId } from '../value-objects/historia-clinica-id.vo.js';
import { PacienteId } from '../value-objects/paciente-id.vo.js';
import { OdontologoId } from '../value-objects/odontologo-id.vo.js';
import { CitaId } from '../value-objects/cita-id.vo.js';
import { EstadoConsulta } from '../value-objects/estado-consulta.enum.js';
import { MotivoConsulta } from '../value-objects/motivo-consulta.vo.js';
import { AnamnesisActual } from '../value-objects/anamnesis-actual.vo.js';
import { ExploracionFisica } from '../value-objects/exploracion-fisica.vo.js';
import { DiagnosticoItem } from '../value-objects/diagnostico-item.vo.js';
import { ProcedimientoRealizado } from '../value-objects/procedimiento-realizado.vo.js';
import { ServicioFacturableConsulta } from '../value-objects/servicio-facturable-consulta.vo.js';
import { EvolucionSOAP } from '../value-objects/evolucion-soap.vo.js';
import { SnapshotRiesgoClinico } from '../value-objects/snapshot-riesgo-clinico.vo.js';
import { ConsultaNoEditableError } from '../errors/consulta-no-editable.error.js';
import { RequisitosCierreConsultaIncumplidosError } from '../errors/requisitos-cierre-consulta-incumplidos.error.js';
import { JustificacionCancelacionRequeridaError } from '../errors/justificacion-cancelacion-requerida.error.js';
import { TransicionEstadoConsultaInvalidaError } from '../errors/transicion-estado-consulta-invalida.error.js';

// ─── Interfaces de Props ──────────────────────────────────────────────────────

export interface AbrirConsultaProps {
  id?: ConsultaId;
  historiaClinicaId: HistoriaClinicaId;
  pacienteId: PacienteId;
  odontologoId: OdontologoId;
  citaId?: CitaId | null;
  versionHistoriaReferenciada: number;
  snapshotRiesgoClinico: SnapshotRiesgoClinico;
  fechaAtencion?: Date;
  motivoConsulta: MotivoConsulta;
  anamnesisActual?: AnamnesisActual;
  exploracionFisica?: ExploracionFisica;
  diagnosticos?: DiagnosticoItem[];
  procedimientosRealizados?: ProcedimientoRealizado[];
  serviciosFacturables?: ServicioFacturableConsulta[];
  observacionesCobro?: string | null;
  evolucionSOAP?: EvolucionSOAP;
  recomendaciones?: string | null;
}

export interface RechazoFacturacion {
  motivoCodigo: string;
  motivo: string;
  rechazadaEn: Date;
}

export interface RevertirCierrePorRechazoProps {
  motivoCodigo: string;
  motivo: string;
  rechazadaEn: Date;
  ahora?: Date;
  actualizadoPor?: OdontologoId;
}

export interface ReconstituirConsultaProps {
  id: ConsultaId;
  historiaClinicaId: HistoriaClinicaId;
  pacienteId: PacienteId;
  odontologoId: OdontologoId;
  citaId: CitaId | null;
  versionHistoriaReferenciada: number;
  snapshotRiesgoClinico: SnapshotRiesgoClinico;
  fechaAtencion: Date;
  cerradaEn: Date | null;
  estado: EstadoConsulta;
  motivoConsulta: MotivoConsulta;
  anamnesisActual: AnamnesisActual;
  exploracionFisica: ExploracionFisica;
  diagnosticos: DiagnosticoItem[];
  procedimientosRealizados: ProcedimientoRealizado[];
  serviciosFacturables?: ServicioFacturableConsulta[];
  observacionesCobro?: string | null;
  evolucionSOAP: EvolucionSOAP;
  recomendaciones: string | null;
  motivoCancelacion: string | null;
  ultimoOutboxEventId?: string | null;
  rechazoFacturacion?: RechazoFacturacion | null;
  version: number;
  creadoEn: Date;
  actualizadoEn: Date;
  creadoPor: OdontologoId;
  actualizadoPor: OdontologoId;
}

export interface OpcionesCompletarConsulta {
  serviciosFacturables?: ServicioFacturableConsulta[];
  observacionesCobro?: string | null;
  ahora?: Date;
}

export interface ActualizarAtencionProps {
  motivoConsulta?: MotivoConsulta;
  anamnesisActual?: AnamnesisActual;
  exploracionFisica?: ExploracionFisica;
  diagnosticos?: DiagnosticoItem[];
  procedimientosRealizados?: ProcedimientoRealizado[];
  evolucionSOAP?: EvolucionSOAP;
  recomendaciones?: string | null;
  actualizadoPor: OdontologoId;
}

// ─── Aggregate Root ───────────────────────────────────────────────────────────

/**
 * Entidad Raíz del agregado Consulta Odontológica.
 *
 * Representa un encuentro clínico transaccional puntual entre un paciente y un odontólogo.
 * Garantiza las 10 invariantes clínicas y el control estricto de la máquina de estados.
 */
export class ConsultaOdontologica {
  private readonly _id: ConsultaId;
  private readonly _historiaClinicaId: HistoriaClinicaId;
  private readonly _pacienteId: PacienteId;
  private readonly _odontologoId: OdontologoId;
  private readonly _citaId: CitaId | null;
  private readonly _versionHistoriaReferenciada: number;
  private readonly _snapshotRiesgoClinico: SnapshotRiesgoClinico;
  private readonly _fechaAtencion: Date;
  private _cerradaEn: Date | null;
  private _estado: EstadoConsulta;
  private _motivoConsulta: MotivoConsulta;
  private _anamnesisActual: AnamnesisActual;
  private _exploracionFisica: ExploracionFisica;
  private _diagnosticos: DiagnosticoItem[];
  private _procedimientosRealizados: ProcedimientoRealizado[];
  private _serviciosFacturables: ServicioFacturableConsulta[];
  private _observacionesCobro: string | null;
  private _evolucionSOAP: EvolucionSOAP;
  private _recomendaciones: string | null;
  private _motivoCancelacion: string | null;
  private _ultimoOutboxEventId: string | null;
  private _rechazoFacturacion: RechazoFacturacion | null;
  private _version: number;
  private readonly _creadoEn: Date;
  private _actualizadoEn: Date;
  private readonly _creadoPor: OdontologoId;
  private _actualizadoPor: OdontologoId;

  private constructor(props: ReconstituirConsultaProps) {
    // Validaciones de consistencia de estado al reconstituir (INV-CONS-01, 04, 05, 06, 09)
    if (props.version < 1) {
      throw new Error(`La versión de la consulta debe ser mayor o igual a 1 (recibido: ${props.version}).`);
    }
    if (props.versionHistoriaReferenciada < 1) {
      throw new Error(
        `La versión de historia referenciada debe ser mayor o igual a 1 (recibido: ${props.versionHistoriaReferenciada}).`
      );
    }

    if (props.estado === EstadoConsulta.COMPLETADA) {
      if (!props.cerradaEn) {
        throw new Error('Una consulta en estado COMPLETADA debe registrar una fecha de cierre (cerradaEn).');
      }
    } else if (props.estado === EstadoConsulta.CANCELADA) {
      if (!props.cerradaEn) {
        throw new Error('Una consulta en estado CANCELADA debe registrar una fecha de cierre (cerradaEn).');
      }
      if (!props.motivoCancelacion || props.motivoCancelacion.trim().length < 10) {
        throw new Error(
          'Una consulta en estado CANCELADA debe registrar un motivo de cancelación de al menos 10 caracteres.'
        );
      }
    } else if (props.estado === EstadoConsulta.EN_CURSO) {
      if (props.cerradaEn !== null && props.cerradaEn !== undefined) {
        throw new Error('Una consulta en estado EN_CURSO no puede tener fecha de cierre (cerradaEn).');
      }
      if (props.motivoCancelacion !== null && props.motivoCancelacion !== undefined) {
        throw new Error('Una consulta en estado EN_CURSO no puede tener motivo de cancelación.');
      }
    }

    this._id = props.id;
    this._historiaClinicaId = props.historiaClinicaId;
    this._pacienteId = props.pacienteId;
    this._odontologoId = props.odontologoId;
    this._citaId = props.citaId ?? null;
    this._versionHistoriaReferenciada = props.versionHistoriaReferenciada;
    this._snapshotRiesgoClinico = props.snapshotRiesgoClinico;
    // Copias defensivas de fechas para evitar referencias mutables externas compartidas
    this._fechaAtencion = new Date(props.fechaAtencion.getTime());
    this._cerradaEn = props.cerradaEn ? new Date(props.cerradaEn.getTime()) : null;
    this._estado = props.estado;
    this._motivoConsulta = props.motivoConsulta;
    this._anamnesisActual = props.anamnesisActual;
    this._exploracionFisica = props.exploracionFisica;
    this._diagnosticos = [...props.diagnosticos];
    this._procedimientosRealizados = [...props.procedimientosRealizados];
    this._serviciosFacturables = props.serviciosFacturables ? [...props.serviciosFacturables] : [];
    this._observacionesCobro = props.observacionesCobro?.trim() || null;
    this._evolucionSOAP = props.evolucionSOAP;
    this._recomendaciones = props.recomendaciones?.trim() || null;
    this._motivoCancelacion = props.motivoCancelacion?.trim() || null;
    this._ultimoOutboxEventId = props.ultimoOutboxEventId?.trim() || null;
    this._rechazoFacturacion = props.rechazoFacturacion
      ? {
          motivoCodigo: props.rechazoFacturacion.motivoCodigo,
          motivo: props.rechazoFacturacion.motivo,
          rechazadaEn: new Date(props.rechazoFacturacion.rechazadaEn.getTime()),
        }
      : null;
    this._version = props.version;
    this._creadoEn = new Date(props.creadoEn.getTime());
    this._actualizadoEn = new Date(props.actualizadoEn.getTime());
    this._creadoPor = props.creadoPor;
    this._actualizadoPor = props.actualizadoPor;
  }

  // ─── Métodos Factoría ───────────────────────────────────────────────────────

  /**
   * Abre un nuevo encuentro clínico odontológico en estado EN_CURSO (INV-CONS-01, 02, 03).
   * @param props Propiedades de apertura inicial.
   * @param ahora Fecha de reloj inyectable para pruebas deterministas.
   */
  static abrir(props: AbrirConsultaProps, ahora: Date = new Date()): ConsultaOdontologica {
    const fechaAtencion = props.fechaAtencion ?? ahora;

    // INV-CONS-03: No futuridad temporal (tolerancia de 60 segundos por desincronización de reloj)
    const margenToleranciaMs = 60_000;
    if (fechaAtencion.getTime() > ahora.getTime() + margenToleranciaMs) {
      throw new Error(
        `La fecha de atención (${fechaAtencion.toISOString()}) no puede ser posterior a la hora actual (${ahora.toISOString()}).`
      );
    }

    if (props.versionHistoriaReferenciada < 1) {
      throw new Error('La versión de historia referenciada debe ser un entero positivo mayor o igual a 1.');
    }

    const id = props.id ?? ConsultaId.generar();

    return new ConsultaOdontologica({
      id,
      historiaClinicaId: props.historiaClinicaId,
      pacienteId: props.pacienteId,
      odontologoId: props.odontologoId,
      citaId: props.citaId ?? null,
      versionHistoriaReferenciada: props.versionHistoriaReferenciada,
      snapshotRiesgoClinico: props.snapshotRiesgoClinico,
      fechaAtencion,
      cerradaEn: null,
      estado: EstadoConsulta.EN_CURSO,
      motivoConsulta: props.motivoConsulta,
      anamnesisActual: props.anamnesisActual ?? AnamnesisActual.vacia(),
      exploracionFisica: props.exploracionFisica ?? ExploracionFisica.vacia(),
      diagnosticos: props.diagnosticos ?? [],
      procedimientosRealizados: props.procedimientosRealizados ?? [],
      serviciosFacturables: props.serviciosFacturables ?? [],
      observacionesCobro: props.observacionesCobro ?? null,
      evolucionSOAP: props.evolucionSOAP ?? EvolucionSOAP.vacia(),
      recomendaciones: props.recomendaciones ?? null,
      motivoCancelacion: null,
      version: 1,
      creadoEn: ahora,
      actualizadoEn: ahora,
      creadoPor: props.odontologoId,
      actualizadoPor: props.odontologoId,
    });
  }

  /**
   * Reconstituye una consulta odontológica completa a partir de los datos almacenados en persistencia.
   */
  static reconstituir(props: ReconstituirConsultaProps): ConsultaOdontologica {
    return new ConsultaOdontologica(props);
  }

  // ─── Métodos de Mutación de Dominio ─────────────────────────────────────────

  /**
   * Actualiza en bloque controlado la información clínica de la atención en sillón (INV-CONS-04, 09).
   * Solo es permitida si la consulta está en estado EN_CURSO.
   * @param props Campos clínicos a actualizar.
   * @param ahora Fecha de reloj inyectable.
   */
  actualizarAtencion(props: ActualizarAtencionProps, ahora: Date = new Date()): void {
    this.asegurarModificable();

    if (props.motivoConsulta) {
      this._motivoConsulta = props.motivoConsulta;
    }
    if (props.anamnesisActual) {
      this._anamnesisActual = props.anamnesisActual;
    }
    if (props.exploracionFisica) {
      this._exploracionFisica = props.exploracionFisica;
    }
    if (props.diagnosticos) {
      this._diagnosticos = [...props.diagnosticos];
    }
    if (props.procedimientosRealizados) {
      this._procedimientosRealizados = [...props.procedimientosRealizados];
    }
    if (props.evolucionSOAP) {
      this._evolucionSOAP = props.evolucionSOAP;
    }
    if (props.recomendaciones !== undefined) {
      this._recomendaciones = props.recomendaciones?.trim() || null;
    }

    this._actualizadoPor = props.actualizadoPor;
    this._actualizadoEn = ahora;
    this._version += 1;
  }

  /**
   * Transiciona la consulta de EN_CURSO a COMPLETADA sellando los datos clínicos (INV-CONS-04, 05).
   * Opcionalmente congela los servicios facturables y observaciones de cobro para integración con MS1.
   * Admite consultas sin servicios facturables (consultas de control o sin costo adicional).
   *
   * @param actualizadoPor Odontólogo responsable del cierre.
   * @param opcionesOFecha Opciones de cierre (servicios facturables, observaciones) o fecha de reloj.
   * @param fechaFallback Fecha de reloj cuando el 2do parámetro son opciones.
   */
  completar(
    actualizadoPor: OdontologoId,
    opcionesOFecha?: Date | OpcionesCompletarConsulta,
    fechaFallback?: Date,
  ): void {
    if (this._estado !== EstadoConsulta.EN_CURSO) {
      throw new TransicionEstadoConsultaInvalidaError(this._estado, EstadoConsulta.COMPLETADA);
    }

    let ahora = new Date();
    let serviciosFacturables: ServicioFacturableConsulta[] = [];
    let observacionesCobro: string | null = null;

    if (opcionesOFecha instanceof Date) {
      ahora = opcionesOFecha;
    } else if (opcionesOFecha && typeof opcionesOFecha === 'object') {
      if (opcionesOFecha.ahora instanceof Date) {
        ahora = opcionesOFecha.ahora;
      } else if (fechaFallback instanceof Date) {
        ahora = fechaFallback;
      }
      if (opcionesOFecha.serviciosFacturables) {
        serviciosFacturables = [...opcionesOFecha.serviciosFacturables];
      }
      if (opcionesOFecha.observacionesCobro !== undefined) {
        observacionesCobro = opcionesOFecha.observacionesCobro?.trim() || null;
      }
    } else if (fechaFallback instanceof Date) {
      ahora = fechaFallback;
    }

    const motivosIncumplidos: string[] = [];

    if (!this._motivoConsulta || this._motivoConsulta.valor.length < 5) {
      motivosIncumplidos.push('El motivo de consulta debe estar registrado con al menos 5 caracteres');
    }

    if (!this._exploracionFisica || !this._exploracionFisica.tieneInspeccionIntraoral) {
      motivosIncumplidos.push('La exploración física debe incluir la inspección intraoral (mínimo 5 caracteres)');
    }

    if (!this._diagnosticos || this._diagnosticos.length === 0) {
      motivosIncumplidos.push('Debe registrarse al menos un diagnóstico clínico (presuntivo o definitivo)');
    }

    if (motivosIncumplidos.length > 0) {
      throw new RequisitosCierreConsultaIncumplidosError(motivosIncumplidos);
    }

    this._estado = EstadoConsulta.COMPLETADA;
    this._serviciosFacturables = serviciosFacturables;
    this._observacionesCobro = observacionesCobro;
    this._cerradaEn = ahora;
    this._rechazoFacturacion = null;
    this._actualizadoEn = ahora;
    this._actualizadoPor = actualizadoPor;
    this._version += 1;
  }

  /**
   * Transiciona la consulta de EN_CURSO a CANCELADA por abandono, deserción o emergencia médica (INV-CONS-04, 06).
   * Requiere justificación médica u operativa obligatoria de al menos 10 caracteres.
   * @param motivoCancelacion Explicación clínica o administrativa detallada.
   * @param actualizadoPor Odontólogo que registra la cancelación.
   * @param ahora Fecha de reloj inyectable.
   */
  cancelar(motivoCancelacion: string, actualizadoPor: OdontologoId, ahora: Date = new Date()): void {
    if (this._estado !== EstadoConsulta.EN_CURSO) {
      throw new TransicionEstadoConsultaInvalidaError(this._estado, EstadoConsulta.CANCELADA);
    }

    const motivo = motivoCancelacion?.trim();
    if (!motivo || motivo.length < 10) {
      throw new JustificacionCancelacionRequeridaError(motivo?.length ?? 0);
    }

    this._estado = EstadoConsulta.CANCELADA;
    this._motivoCancelacion = motivo;
    this._cerradaEn = ahora;
    this._actualizadoEn = ahora;
    this._actualizadoPor = actualizadoPor;
    this._version += 1;
  }

  /**
   * Revierte una consulta COMPLETADA a EN_CURSO por rechazo de facturación en el ERP (Saga T3).
   * Deshace el cierre clínico sin borrar diagnósticos, procedimientos ni servicios.
   * Almacena el motivo de rechazo estructurado para que el odontólogo lo visualice y corrija.
   *
   * @param props Información del rechazo devuelta por el ERP.
   * @param ahora Fecha de reloj inyectable.
   */
  revertirCierrePorRechazoFacturacion(
    props: RevertirCierrePorRechazoProps,
    ahora: Date = new Date(),
  ): void {
    if (this._estado !== EstadoConsulta.COMPLETADA) {
      throw new TransicionEstadoConsultaInvalidaError(
        this._estado,
        EstadoConsulta.EN_CURSO,
      );
    }

    const timestamp = props.ahora ?? ahora;
    this._estado = EstadoConsulta.EN_CURSO;
    this._cerradaEn = null;
    this._rechazoFacturacion = {
      motivoCodigo: props.motivoCodigo,
      motivo: props.motivo.slice(0, 500),
      rechazadaEn: new Date(props.rechazadaEn.getTime()),
    };
    if (props.actualizadoPor) {
      this._actualizadoPor = props.actualizadoPor;
    }
    this._actualizadoEn = timestamp;
    this._version += 1;
  }

  /**
   * Asocia el identificador del evento Outbox vigente que selló el cierre para la guardia de versión.
   */
  asignarUltimoOutboxEventId(eventId: string): void {
    this._ultimoOutboxEventId = eventId?.trim() || null;
  }

  // ─── Helpers de Invariantes ─────────────────────────────────────────────────

  /**
   * Verifica la regla de inmutabilidad (INV-CONS-04).
   * Si la consulta no está EN_CURSO, rechaza la edición.
   */
  private asegurarModificable(): void {
    if (this._estado !== EstadoConsulta.EN_CURSO) {
      throw new ConsultaNoEditableError(this._estado);
    }
  }

  // ─── Getters ────────────────────────────────────────────────────────────────

  get id(): ConsultaId {
    return this._id;
  }

  get historiaClinicaId(): HistoriaClinicaId {
    return this._historiaClinicaId;
  }

  get pacienteId(): PacienteId {
    return this._pacienteId;
  }

  get odontologoId(): OdontologoId {
    return this._odontologoId;
  }

  get citaId(): CitaId | null {
    return this._citaId;
  }

  get versionHistoriaReferenciada(): number {
    return this._versionHistoriaReferenciada;
  }

  get snapshotRiesgoClinico(): SnapshotRiesgoClinico {
    return this._snapshotRiesgoClinico;
  }

  get fechaAtencion(): Date {
    return new Date(this._fechaAtencion.getTime());
  }

  get cerradaEn(): Date | null {
    return this._cerradaEn ? new Date(this._cerradaEn.getTime()) : null;
  }

  get estado(): EstadoConsulta {
    return this._estado;
  }

  get motivoConsulta(): MotivoConsulta {
    return this._motivoConsulta;
  }

  get anamnesisActual(): AnamnesisActual {
    return this._anamnesisActual;
  }

  get exploracionFisica(): ExploracionFisica {
    return this._exploracionFisica;
  }

  get diagnosticos(): ReadonlyArray<DiagnosticoItem> {
    return Object.freeze([...this._diagnosticos]);
  }

  get procedimientosRealizados(): ReadonlyArray<ProcedimientoRealizado> {
    return Object.freeze([...this._procedimientosRealizados]);
  }

  get serviciosFacturables(): ReadonlyArray<ServicioFacturableConsulta> {
    return Object.freeze([...this._serviciosFacturables]);
  }

  get observacionesCobro(): string | null {
    return this._observacionesCobro;
  }

  get tieneServiciosFacturables(): boolean {
    return this._serviciosFacturables.length > 0;
  }

  calcularTotalFacturableBs(): string {
    const total = this._serviciosFacturables.reduce(
      (sum, item) => sum + Number(item.calcularSubtotalBs()),
      0,
    );
    return total.toFixed(2);
  }

  get evolucionSOAP(): EvolucionSOAP {
    return this._evolucionSOAP;
  }

  get recomendaciones(): string | null {
    return this._recomendaciones;
  }

  get motivoCancelacion(): string | null {
    return this._motivoCancelacion;
  }

  get version(): number {
    return this._version;
  }

  get creadoEn(): Date {
    return new Date(this._creadoEn.getTime());
  }

  get actualizadoEn(): Date {
    return new Date(this._actualizadoEn.getTime());
  }

  get creadoPor(): OdontologoId {
    return this._creadoPor;
  }

  get actualizadoPor(): OdontologoId {
    return this._actualizadoPor;
  }

  get ultimoOutboxEventId(): string | null {
    return this._ultimoOutboxEventId;
  }

  get rechazoFacturacion(): RechazoFacturacion | null {
    return this._rechazoFacturacion
      ? {
          motivoCodigo: this._rechazoFacturacion.motivoCodigo,
          motivo: this._rechazoFacturacion.motivo,
          rechazadaEn: new Date(this._rechazoFacturacion.rechazadaEn.getTime()),
        }
      : null;
  }

  get estaEnCurso(): boolean {
    return this._estado === EstadoConsulta.EN_CURSO;
  }

  get estaCompletada(): boolean {
    return this._estado === EstadoConsulta.COMPLETADA;
  }

  get estaCancelada(): boolean {
    return this._estado === EstadoConsulta.CANCELADA;
  }
}
