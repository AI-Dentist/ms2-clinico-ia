import { OdontogramaId } from '../value-objects/odontograma-id.vo.js';
import { RevisionId } from '../value-objects/revision-id.vo.js';
import { HistoriaClinicaId } from '../../../historias-clinicas/domain/value-objects/historia-clinica-id.vo.js';
import { PacienteId } from '../../../historias-clinicas/domain/value-objects/paciente-id.vo.js';
import { OdontologoId } from '../../../historias-clinicas/domain/value-objects/odontologo-id.vo.js';
import type { ConsultaId } from '../../../consultas-odontologicas/domain/value-objects/consulta-id.vo.js';
import { PiezaDentalFDI } from '../../../consultas-odontologicas/domain/value-objects/pieza-dental-fdi.vo.js';
import {
  PiezaDentalOdontograma,
  type PiezaDentalSnapshotProps,
} from './pieza-dental-odontograma.entity.js';
import { RevisionOdontograma } from './revision-odontograma.entity.js';
import { TipoRevisionOdontograma } from '../value-objects/tipo-revision-odontograma.enum.js';
import {
  DeltaPiezaOdontograma,
  type DeltaPiezaOdontogramaProps,
} from '../value-objects/delta-pieza-odontograma.vo.js';
import { TratamientoEstructural } from '../value-objects/tratamiento-estructural.vo.js';
import { ConflictoConcurrenteOdontogramaError } from '../errors/conflicto-concurrente-odontograma.error.js';
import { EnmiendaCorrectivaInvalidaError } from '../errors/enmienda-correctiva-invalida.error.js';

export interface ReconstituirOdontogramaProps {
  id: OdontogramaId;
  historiaClinicaId: HistoriaClinicaId;
  pacienteId: PacienteId;
  piezas: Map<number, PiezaDentalOdontograma>;
  revisionActualId: RevisionId;
  totalRevisiones: number;
  version: number;
  creadoEn: Date;
  actualizadoEn: Date;
  actualizadoPor: OdontologoId;
}

export interface AplicarRevisionProps {
  revisionId?: RevisionId;
  tipoRevision: TipoRevisionOdontograma;
  revisionCorregidaId?: RevisionId | null;
  aplicaAlEstadoActual: boolean;
  snapshotBaseRevisionCorregida?: ReadonlyArray<PiezaDentalSnapshotProps>;
  consultaId?: ConsultaId | null;
  odontologoId: OdontologoId;
  fechaObservacionClinica: Date;
  motivoRevision: string;
  versionEsperada: number;
  deltas: DeltaPiezaOdontogramaProps[];
  ahora?: Date;
}

/**
 * Aggregate Root del Odontograma Clínico Longitudinal.
 * Administra el estado consolidado de las 52 piezas FDI y coordina la generación
 * inmutable de revisiones históricas y enmiendas (INV-ODO-01 a INV-ODO-07).
 */
export class Odontograma {
  private readonly _id: OdontogramaId;
  private readonly _historiaClinicaId: HistoriaClinicaId;
  private readonly _pacienteId: PacienteId;
  private _piezas: Map<number, PiezaDentalOdontograma>;
  private _revisionActualId: RevisionId;
  private _totalRevisiones: number;
  private _version: number;
  private readonly _creadoEn: Date;
  private _actualizadoEn: Date;
  private _actualizadoPor: OdontologoId;

  private constructor(props: ReconstituirOdontogramaProps) {
    if (!props.id) throw new Error('OdontogramaId es obligatorio.');
    if (!props.historiaClinicaId) throw new Error('HistoriaClinicaId es obligatorio.');
    if (!props.pacienteId) throw new Error('PacienteId es obligatorio.');
    if (!props.piezas || props.piezas.size !== 52) {
      throw new Error(`El odontograma debe contener exactamente 52 piezas FDI (recibido: ${props.piezas?.size ?? 0}).`);
    }
    if (!props.revisionActualId) throw new Error('RevisionActualId es obligatorio.');
    if (props.version < 1) throw new Error('La versión debe ser un entero positivo >= 1.');

    this._id = props.id;
    this._historiaClinicaId = props.historiaClinicaId;
    this._pacienteId = props.pacienteId;
    this._piezas = new Map(props.piezas);
    this._revisionActualId = props.revisionActualId;
    this._totalRevisiones = props.totalRevisiones;
    this._version = props.version;
    this._creadoEn = new Date(props.creadoEn.getTime());
    this._actualizadoEn = new Date(props.actualizadoEn.getTime());
    this._actualizadoPor = props.actualizadoPor;
  }

  /**
   * Fábrica: Inicializa el odontograma longitudinal con las 52 posiciones FDI válidas (INV-ODO-01).
   * Todas las piezas inician con estadoAnatomico = DESCONOCIDO y estadoEvaluacion = NO_EVALUADO.
   * Genera de forma atómica la Revisión 1 basal.
   */
  static inicializar(props: {
    id?: OdontogramaId;
    historiaClinicaId: HistoriaClinicaId;
    pacienteId: PacienteId;
    odontologoId: OdontologoId;
    ahora?: Date;
  }): { odontograma: Odontograma; revisionBasal: RevisionOdontograma } {
    const ahora = props.ahora ? new Date(props.ahora.getTime()) : new Date();
    const odontogramaId = props.id ?? OdontogramaId.generar();
    const revisionBasalId = RevisionId.generar();

    // 1. Crear las 52 posiciones FDI válidas
    const piezasMap = new Map<number, PiezaDentalOdontograma>();
    for (const fdiNumero of PiezaDentalFDI.piezasValidas) {
      const fdiVo = PiezaDentalFDI.crear(fdiNumero);
      piezasMap.set(fdiNumero, PiezaDentalOdontograma.crearInicial(fdiVo));
    }

    if (piezasMap.size !== 52) {
      throw new Error(`Error interno: se esperaban 52 piezas FDI pero se generaron ${piezasMap.size}.`);
    }

    // 2. Snapshot basal de las 52 piezas
    const snapshotBasal: PiezaDentalSnapshotProps[] = [];
    for (const p of piezasMap.values()) {
      snapshotBasal.push(p.toSnapshot());
    }

    // 3. Revisión 1 basal
    const revisionBasal = new RevisionOdontograma({
      id: revisionBasalId,
      odontogramaId,
      historiaClinicaId: props.historiaClinicaId,
      consultaId: null,
      numeroRevision: 1,
      tipoRevision: TipoRevisionOdontograma.NUEVA_OBSERVACION,
      revisionCorregidaId: null,
      aplicaAlEstadoActual: true,
      fechaRegistro: ahora,
      fechaObservacionClinica: ahora,
      registradoPor: props.odontologoId,
      motivoRevision: 'Inicialización basal del odontograma clínico con 52 posiciones no evaluadas',
      cambiosAplicados: [],
      snapshotPiezas: snapshotBasal,
    });

    // 4. Instancia del Aggregate Root
    const odontograma = new Odontograma({
      id: odontogramaId,
      historiaClinicaId: props.historiaClinicaId,
      pacienteId: props.pacienteId,
      piezas: piezasMap,
      revisionActualId: revisionBasalId,
      totalRevisiones: 1,
      version: 1,
      creadoEn: ahora,
      actualizadoEn: ahora,
      actualizadoPor: props.odontologoId,
    });

    return { odontograma, revisionBasal };
  }

  static reconstituir(props: ReconstituirOdontogramaProps): Odontograma {
    return new Odontograma(props);
  }

  // ─── Getters ───────────────────────────────────────────────────────────────

  get id(): OdontogramaId {
    return this._id;
  }

  get historiaClinicaId(): HistoriaClinicaId {
    return this._historiaClinicaId;
  }

  get pacienteId(): PacienteId {
    return this._pacienteId;
  }

  get piezas(): ReadonlyMap<number, PiezaDentalOdontograma> {
    const copia = new Map<number, PiezaDentalOdontograma>();
    for (const [fdi, p] of this._piezas.entries()) {
      copia.set(fdi, p.clonar());
    }
    return copia;
  }

  get revisionActualId(): RevisionId {
    return this._revisionActualId;
  }

  get totalRevisiones(): number {
    return this._totalRevisiones;
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

  get actualizadoPor(): OdontologoId {
    return this._actualizadoPor;
  }

  /**
   * Obtiene una copia independiente de la pieza dental por su número FDI para preservar la encapsulación.
   */
  obtenerPieza(fdi: number | PiezaDentalFDI): PiezaDentalOdontograma {
    const valor = typeof fdi === 'number' ? fdi : fdi.valor;
    const pieza = this._piezas.get(valor);
    if (!pieza) {
      throw new Error(`Pieza dental FDI ${valor} no encontrada en el odontograma.`);
    }
    return pieza.clonar();
  }

  /**
   * Retorna el snapshot consolidado actual de las 52 piezas dentales.
   */
  obtenerSnapshot(): ReadonlyArray<PiezaDentalSnapshotProps> {
    const snapshots: PiezaDentalSnapshotProps[] = [];
    for (const p of this._piezas.values()) {
      snapshots.push(p.toSnapshot());
    }
    return Object.freeze(snapshots);
  }

  // ─── Modificaciones del Estado y Generación de Revisiones ──────────────────

  /**
   * Aplica una nueva revisión u enmienda al odontograma validando concurrencia optimista (INV-ODO-05, INV-ODO-06).
   *
   * Utiliza una copia de trabajo para prevenir mutaciones parciales en memoria ante fallos de validación.
   *
   * Si aplicaAlEstadoActual es false (enmienda que solo rectifica el historial histórico), la proyección
   * activa (_piezas y _revisionActualId) no se altera, pero sí se incrementa la versión y el total de revisiones.
   * Para enmiendas retrospectivas, se exige snapshotBaseRevisionCorregida para derivar el snapshot rectificado
   * sin inventar datos ni alterar el presente vigente.
   */
  aplicarRevision(props: AplicarRevisionProps): RevisionOdontograma {
    const ahora = props.ahora ? new Date(props.ahora.getTime()) : new Date();

    // 1. Control de Concurrencia Optimista (INV-ODO-06)
    if (this._version !== props.versionEsperada) {
      throw new ConflictoConcurrenteOdontogramaError(this._id.valor, props.versionEsperada);
    }

    // 2. Preparar copia de trabajo aislada (Zero Partial Mutations)
    let piezasTrabajo: Map<number, PiezaDentalOdontograma>;

    if (props.tipoRevision === TipoRevisionOdontograma.ENMIENDA_CORRECTIVA && !props.aplicaAlEstadoActual) {
      if (!props.snapshotBaseRevisionCorregida || props.snapshotBaseRevisionCorregida.length !== 52) {
        throw new EnmiendaCorrectivaInvalidaError(
          `Para aplicar una enmienda correctiva retrospectiva (aplicaAlEstadoActual = false), es obligatorio proporcionar el snapshot base completo de 52 piezas de la revisión corregida (recibido: ${props.snapshotBaseRevisionCorregida?.length ?? 0}).`
        );
      }
      piezasTrabajo = new Map<number, PiezaDentalOdontograma>();
      for (const snapshotPieza of props.snapshotBaseRevisionCorregida) {
        piezasTrabajo.set(snapshotPieza.numeroFDI, PiezaDentalOdontograma.desdeSnapshot(snapshotPieza));
      }
    } else {
      piezasTrabajo = new Map<number, PiezaDentalOdontograma>();
      for (const [fdi, pieza] of this._piezas.entries()) {
        piezasTrabajo.set(fdi, pieza.clonar());
      }
    }

    const deltasDominio: DeltaPiezaOdontograma[] = [];

    // 3. Aplicar y validar deltas sobre la copia de trabajo
    for (const deltaProps of props.deltas) {
      const piezaTrabajo = piezasTrabajo.get(deltaProps.numeroFDI);
      if (!piezaTrabajo) {
        throw new Error(`No se puede aplicar delta: la pieza FDI ${deltaProps.numeroFDI} no existe.`);
      }

      // 3.a. Actualizar estado anatómico
      if (deltaProps.estadoAnatomicoNuevo && deltaProps.estadoAnatomicoNuevo !== piezaTrabajo.estadoAnatomico) {
        piezaTrabajo.actualizarEstadoAnatomico(deltaProps.estadoAnatomicoNuevo);
      }

      // 3.b. Actualizar superficies
      if (deltaProps.superficiesModificadas) {
        for (const supMod of deltaProps.superficiesModificadas) {
          piezaTrabajo.establecerCondicionSuperficie(supMod.superficie, supMod.condicionNueva);
        }
      }

      // 3.c. Agregar tratamiento estructural
      if (deltaProps.tratamientoEstructuralAgregado) {
        const tratamiento = TratamientoEstructural.crear(
          deltaProps.tratamientoEstructuralAgregado,
          props.consultaId,
          ahora
        );
        piezaTrabajo.agregarTratamientoEstructural(tratamiento);
      }

      // 3.d. Actualizar observaciones
      if (deltaProps.observaciones !== undefined) {
        piezaTrabajo.actualizarObservaciones(deltaProps.observaciones);
      }

      deltasDominio.push(new DeltaPiezaOdontograma(deltaProps));
    }

    // 4. Determinar snapshot de la revisión
    // Si aplicaAlEstadoActual = true, el snapshot de la revisión es el nuevo estado resultante
    // Si aplicaAlEstadoActual = false, el snapshot histórico registra el estado rectificado sin alterar el presente
    const snapshotRevision: PiezaDentalSnapshotProps[] = [];
    for (const p of piezasTrabajo.values()) {
      snapshotRevision.push(p.toSnapshot());
    }

    const nuevoNumeroRevision = this._totalRevisiones + 1;
    const revisionId = props.revisionId ?? RevisionId.generar();

    // 5. Instanciar la nueva entidad RevisionOdontograma (valida reglas de enmienda INV-ODO-05)
    const nuevaRevision = new RevisionOdontograma({
      id: revisionId,
      odontogramaId: this._id,
      historiaClinicaId: this._historiaClinicaId,
      consultaId: props.consultaId ?? null,
      numeroRevision: nuevoNumeroRevision,
      tipoRevision: props.tipoRevision,
      revisionCorregidaId: props.revisionCorregidaId ?? null,
      aplicaAlEstadoActual: props.aplicaAlEstadoActual,
      fechaRegistro: ahora,
      fechaObservacionClinica: props.fechaObservacionClinica,
      registradoPor: props.odontologoId,
      motivoRevision: props.motivoRevision,
      cambiosAplicados: deltasDominio,
      snapshotPiezas: snapshotRevision,
    });

    // 6. Confirmar mutación en el agregado maestro
    if (props.aplicaAlEstadoActual) {
      this._piezas = piezasTrabajo;
      this._revisionActualId = nuevaRevision.id;
    }

    this._actualizadoEn = ahora;
    this._actualizadoPor = props.odontologoId;
    this._totalRevisiones = nuevoNumeroRevision;
    this._version += 1;

    return nuevaRevision;
  }
}
