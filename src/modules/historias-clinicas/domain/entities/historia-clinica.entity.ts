import { HistoriaClinicaId } from '../value-objects/historia-clinica-id.vo.js';
import { PacienteId } from '../value-objects/paciente-id.vo.js';
import { OdontologoId } from '../value-objects/odontologo-id.vo.js';
import { EstadoHistoria } from '../value-objects/estado-historia.enum.js';
import { AccionAuditoria } from '../value-objects/accion-auditoria.enum.js';
import { Antecedentes } from '../value-objects/antecedentes.vo.js';
import { Alergia } from '../value-objects/alergia.vo.js';
import { Medicamento } from '../value-objects/medicamento.vo.js';
import { EntradaAuditoria } from '../value-objects/entrada-auditoria.vo.js';
import { HistoriaClinicaNoEditableError } from '../errors/historia-clinica-no-editable.error.js';
import { TransicionEstadoInvalidaError } from '../errors/transicion-estado-invalida.error.js';
import { AlergiaDuplicadaError } from '../errors/alergia-duplicada.error.js';

// ─── Interfaces de props ─────────────────────────────────────────────────────

export interface CrearHistoriaClinicaProps {
  pacienteId: PacienteId;
  odontologoResponsableId?: OdontologoId;
  /** Si se omite, se inicia con todos los campos en NO_EVALUADO. */
  antecedentes?: Antecedentes;
  alergias?: Alergia[];
  medicamentosActuales?: Medicamento[];
  observacionesGenerales?: string | null;
}

export interface ReconstituirHistoriaClinicaProps {
  id: HistoriaClinicaId;
  pacienteId: PacienteId;
  odontologoResponsableId: OdontologoId;
  estado: EstadoHistoria;
  antecedentes: Antecedentes;
  alergias: Alergia[];
  medicamentosActuales: Medicamento[];
  observacionesGenerales: string | null;
  version: number;
  creadoEn: Date;
  actualizadoEn: Date;
  historialCambios: EntradaAuditoria[];
}

// ─── Máquina de estados ───────────────────────────────────────────────────────

/**
 * Transiciones de estado permitidas.
 * La clave es el estado actual; el valor es el conjunto de estados destino válidos.
 */
const TRANSICIONES_PERMITIDAS: Record<EstadoHistoria, Set<EstadoHistoria>> = {
  [EstadoHistoria.ACTIVA]: new Set([EstadoHistoria.CERRADA, EstadoHistoria.ARCHIVADA]),
  [EstadoHistoria.CERRADA]: new Set([EstadoHistoria.ACTIVA, EstadoHistoria.ARCHIVADA]),
  [EstadoHistoria.ARCHIVADA]: new Set(), // Irreversible — ninguna transición permitida
};

// ─── Aggregate Root ───────────────────────────────────────────────────────────

/**
 * Entidad raíz del agregado Historia Clínica.
 *
 * Toda modificación al expediente pasa por esta clase para garantizar
 * las invariantes de dominio antes de persistir.
 *
 * Reglas fundamentales:
 *  - INV-01: Un solo expediente por paciente.
 *  - INV-02: pacienteId y odontologoResponsableId son obligatorios.
 *  - INV-03: ARCHIVADA → no editable.
 *  - INV-04: CERRADA → no editable (excepto cambiarEstado a ACTIVA).
 *  - INV-05: No duplicar alergias por sustancia (case-insensitive).
 *  - INV-06: Toda modificación genera EntradaAuditoria.
 *  - INV-07: version se incrementa en cada actualización.
 *  - INV-08: CampoClinico CONFIRMADO requiere detalle no vacío.
 *  - INV-09: actualizadoEn refleja la fecha real del cambio.
 */
export class HistoriaClinica {
  private readonly _id: HistoriaClinicaId;
  private readonly _pacienteId: PacienteId;
  private _odontologoResponsableId: OdontologoId;
  private _estado: EstadoHistoria;
  private _antecedentes: Antecedentes;
  private _alergias: Alergia[];
  private _medicamentosActuales: Medicamento[];
  private _observacionesGenerales: string | null;
  private _version: number;
  private readonly _creadoEn: Date;
  private _actualizadoEn: Date;
  private readonly _historialCambios: EntradaAuditoria[];

  private constructor(props: ReconstituirHistoriaClinicaProps) {
    this._id = props.id;
    this._pacienteId = props.pacienteId;
    this._odontologoResponsableId = props.odontologoResponsableId;
    this._estado = props.estado;
    this._antecedentes = props.antecedentes;
    this._alergias = [...props.alergias];
    this._medicamentosActuales = [...props.medicamentosActuales];
    this._observacionesGenerales = props.observacionesGenerales;
    this._version = props.version;
    this._creadoEn = props.creadoEn;
    this._actualizadoEn = props.actualizadoEn;
    this._historialCambios = [...props.historialCambios];
  }

  // ─── Factory: Creación ──────────────────────────────────────────────────────

  /**
   * Crea una nueva historia clínica.
   * El ID y los timestamps son generados por el dominio.
   * Agrega automáticamente la primera EntradaAuditoria (CREACION).
   */
  static crear(
    props: CrearHistoriaClinicaProps,
    odontologoId: OdontologoId,
  ): HistoriaClinica {
    const ahora = new Date();
    const id = HistoriaClinicaId.generar();
    const entradaInicial = EntradaAuditoria.crear({
      accion: AccionAuditoria.CREACION,
      odontologoId,
      fechaHora: ahora,
      camposModificados: [],
      descripcion: 'Apertura inicial del expediente clínico.',
    });

    return new HistoriaClinica({
      id,
      pacienteId: props.pacienteId,
      odontologoResponsableId: props.odontologoResponsableId ?? odontologoId,
      estado: EstadoHistoria.ACTIVA,
      antecedentes: props.antecedentes ?? Antecedentes.porDefecto(),
      alergias: props.alergias ?? [],
      medicamentosActuales: props.medicamentosActuales ?? [],
      observacionesGenerales: props.observacionesGenerales ?? null,
      version: 1,
      creadoEn: ahora,
      actualizadoEn: ahora,
      historialCambios: [entradaInicial],
    });
  }

  // ─── Factory: Reconstitución desde persistencia ─────────────────────────────

  /**
   * Reconstituye la entidad desde datos almacenados.
   * No genera auditoría ni modifica el estado; solo hidrata la entidad.
   */
  static reconstituir(props: ReconstituirHistoriaClinicaProps): HistoriaClinica {
    return new HistoriaClinica(props);
  }

  // ─── Comandos de dominio ────────────────────────────────────────────────────

  /**
   * Actualiza el bloque de antecedentes.
   * @throws HistoriaClinicaNoEditableError si el estado no es ACTIVA.
   */
  actualizarAntecedentes(
    nuevosAntecedentes: Antecedentes,
    odontologoId: OdontologoId,
    camposModificados: string[],
    descripcion?: string | null,
  ): void {
    this.assertEditable();
    this._antecedentes = nuevosAntecedentes;
    this.registrarCambio(
      AccionAuditoria.ACTUALIZACION_ANTECEDENTES,
      odontologoId,
      camposModificados,
      descripcion ?? null,
    );
  }

  /**
   * Agrega una nueva alergia al expediente.
   * @throws HistoriaClinicaNoEditableError si el estado no es ACTIVA.
   * @throws AlergiaDuplicadaError si ya existe una alergia para la misma sustancia.
   */
  agregarAlergia(
    alergia: Alergia,
    odontologoId: OdontologoId,
    descripcion?: string | null,
  ): void {
    this.assertEditable();
    const existe = this._alergias.some((a) => a.mismaSustanciaQue(alergia.sustancia));
    if (existe) {
      throw new AlergiaDuplicadaError(alergia.sustancia);
    }
    this._alergias.push(alergia);
    this.registrarCambio(
      AccionAuditoria.ADICION_ALERGIA,
      odontologoId,
      ['alergias'],
      descripcion ?? null,
    );
  }

  /**
   * Elimina la alergia correspondiente a la sustancia indicada (case-insensitive).
   * @throws HistoriaClinicaNoEditableError si el estado no es ACTIVA.
   * @throws Error si la sustancia no está registrada.
   */
  eliminarAlergia(
    sustancia: string,
    odontologoId: OdontologoId,
    descripcion?: string | null,
  ): void {
    this.assertEditable();
    const indice = this._alergias.findIndex((a) => a.mismaSustanciaQue(sustancia));
    if (indice === -1) {
      throw new Error(`No existe alergia registrada para la sustancia '${sustancia}'.`);
    }
    this._alergias.splice(indice, 1);
    this.registrarCambio(
      AccionAuditoria.ELIMINACION_ALERGIA,
      odontologoId,
      ['alergias'],
      descripcion ?? null,
    );
  }

  /**
   * Reemplaza la lista de medicamentos actuales.
   * @throws HistoriaClinicaNoEditableError si el estado no es ACTIVA.
   */
  actualizarMedicamentos(
    medicamentos: Medicamento[],
    odontologoId: OdontologoId,
    descripcion?: string | null,
  ): void {
    this.assertEditable();
    this._medicamentosActuales = [...medicamentos];
    this.registrarCambio(
      AccionAuditoria.ACTUALIZACION_MEDICAMENTOS,
      odontologoId,
      ['medicamentosActuales'],
      descripcion ?? null,
    );
  }

  /**
   * Actualiza las observaciones generales del expediente.
   * @throws HistoriaClinicaNoEditableError si el estado no es ACTIVA.
   */
  actualizarObservaciones(
    observaciones: string | null,
    odontologoId: OdontologoId,
    descripcion?: string | null,
  ): void {
    this.assertEditable();
    this._observacionesGenerales = observaciones?.trim() ?? null;
    this.registrarCambio(
      AccionAuditoria.ACTUALIZACION_OBSERVACIONES,
      odontologoId,
      ['observacionesGenerales'],
      descripcion ?? null,
    );
  }

  /**
   * Cambia el estado del expediente respetando la máquina de estados.
   * @throws TransicionEstadoInvalidaError si la transición no está permitida.
   */
  cambiarEstado(
    nuevoEstado: EstadoHistoria,
    odontologoId: OdontologoId,
    descripcion?: string | null,
  ): void {
    const transicionesValidas = TRANSICIONES_PERMITIDAS[this._estado];
    if (!transicionesValidas.has(nuevoEstado)) {
      throw new TransicionEstadoInvalidaError(this._estado, nuevoEstado);
    }
    this._estado = nuevoEstado;
    this.registrarCambio(
      AccionAuditoria.CAMBIO_ESTADO,
      odontologoId,
      ['estado'],
      descripcion ?? null,
    );
  }

  // ─── Getters (lectura del estado) ───────────────────────────────────────────

  get id(): HistoriaClinicaId {
    return this._id;
  }

  get pacienteId(): PacienteId {
    return this._pacienteId;
  }

  get odontologoResponsableId(): OdontologoId {
    return this._odontologoResponsableId;
  }

  get estado(): EstadoHistoria {
    return this._estado;
  }

  get antecedentes(): Antecedentes {
    return this._antecedentes;
  }

  get alergias(): readonly Alergia[] {
    return this._alergias;
  }

  get medicamentosActuales(): readonly Medicamento[] {
    return this._medicamentosActuales;
  }

  get observacionesGenerales(): string | null {
    return this._observacionesGenerales;
  }

  get version(): number {
    return this._version;
  }

  get creadoEn(): Date {
    return this._creadoEn;
  }

  get actualizadoEn(): Date {
    return this._actualizadoEn;
  }

  /** Retorna una copia del historial para evitar mutaciones externas. */
  get historialCambios(): readonly EntradaAuditoria[] {
    return this._historialCambios;
  }

  // ─── Helpers privados ───────────────────────────────────────────────────────

  /**
   * Verifica que la historia esté en estado ACTIVA antes de cualquier modificación.
   * @throws HistoriaClinicaNoEditableError si no está en estado ACTIVA.
   */
  private assertEditable(): void {
    if (this._estado !== EstadoHistoria.ACTIVA) {
      throw new HistoriaClinicaNoEditableError(this._estado);
    }
  }

  /**
   * Registra una entrada de auditoría, incrementa la versión y actualiza el timestamp.
   * Es el único camino para mutar el estado interno del agregado.
   */
  private registrarCambio(
    accion: AccionAuditoria,
    odontologoId: OdontologoId,
    camposModificados: string[],
    descripcion: string | null,
  ): void {
    const ahora = new Date();
    this._version += 1;
    this._actualizadoEn = ahora;
    this._historialCambios.push(
      EntradaAuditoria.crear({
        accion,
        odontologoId,
        fechaHora: ahora,
        camposModificados,
        descripcion,
      }),
    );
  }
}
