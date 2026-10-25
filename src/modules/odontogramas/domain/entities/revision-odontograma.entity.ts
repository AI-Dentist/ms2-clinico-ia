import { RevisionId } from '../value-objects/revision-id.vo.js';
import { OdontogramaId } from '../value-objects/odontograma-id.vo.js';
import type { HistoriaClinicaId } from '../../../historias-clinicas/domain/value-objects/historia-clinica-id.vo.js';
import type { ConsultaId } from '../../../consultas-odontologicas/domain/value-objects/consulta-id.vo.js';
import type { OdontologoId } from '../../../historias-clinicas/domain/value-objects/odontologo-id.vo.js';
import { TipoRevisionOdontograma } from '../value-objects/tipo-revision-odontograma.enum.js';
import { DeltaPiezaOdontograma } from '../value-objects/delta-pieza-odontograma.vo.js';
import type { PiezaDentalSnapshotProps } from './pieza-dental-odontograma.entity.js';
import { EnmiendaCorrectivaInvalidaError } from '../errors/enmienda-correctiva-invalida.error.js';

export interface RevisionOdontogramaProps {
  id: RevisionId;
  odontogramaId: OdontogramaId;
  historiaClinicaId: HistoriaClinicaId;
  consultaId?: ConsultaId | null;
  numeroRevision: number;
  tipoRevision: TipoRevisionOdontograma;
  revisionCorregidaId?: RevisionId | null;
  aplicaAlEstadoActual: boolean;
  fechaRegistro: Date;
  fechaObservacionClinica: Date;
  registradoPor: OdontologoId;
  motivoRevision: string;
  cambiosAplicados: DeltaPiezaOdontograma[];
  snapshotPiezas: PiezaDentalSnapshotProps[];
}

/**
 * Entidad inmutable que representa una revisión histórica o enmienda sellada del Odontograma (INV-ODO-05, INV-ODO-07).
 */
export class RevisionOdontograma {
  private readonly _id: RevisionId;
  private readonly _odontogramaId: OdontogramaId;
  private readonly _historiaClinicaId: HistoriaClinicaId;
  private readonly _consultaId: ConsultaId | null;
  private readonly _numeroRevision: number;
  private readonly _tipoRevision: TipoRevisionOdontograma;
  private readonly _revisionCorregidaId: RevisionId | null;
  private readonly _aplicaAlEstadoActual: boolean;
  private readonly _fechaRegistro: Date;
  private readonly _fechaObservacionClinica: Date;
  private readonly _registradoPor: OdontologoId;
  private readonly _motivoRevision: string;
  private readonly _cambiosAplicados: ReadonlyArray<DeltaPiezaOdontograma>;
  private readonly _snapshotPiezas: ReadonlyArray<PiezaDentalSnapshotProps>;

  constructor(props: RevisionOdontogramaProps) {
    if (!props.id) {
      throw new Error('RevisionId es obligatorio.');
    }
    if (!props.odontogramaId) {
      throw new Error('OdontogramaId es obligatorio.');
    }
    if (!props.historiaClinicaId) {
      throw new Error('HistoriaClinicaId es obligatorio.');
    }
    if (!props.numeroRevision || props.numeroRevision < 1) {
      throw new Error('El número secuencial de revisión debe ser un entero positivo >= 1.');
    }
    if (!props.registradoPor) {
      throw new Error('El odontólogo responsable del registro es obligatorio.');
    }

    const motivo = props.motivoRevision?.trim();
    if (!motivo) {
      throw new Error('El motivo de la revisión es obligatorio.');
    }

    // Reglas de validación para Enmiendas Correctivas (INV-ODO-05)
    if (props.tipoRevision === TipoRevisionOdontograma.ENMIENDA_CORRECTIVA) {
      if (!props.revisionCorregidaId) {
        throw new EnmiendaCorrectivaInvalidaError(
          'Toda enmienda correctiva debe referenciar obligatoriamente el identificador de la revisión corregida (revisionCorregidaId).'
        );
      }
      if (props.revisionCorregidaId.equals(props.id)) {
        throw new EnmiendaCorrectivaInvalidaError('Una enmienda no puede referenciarse a sí misma como revisión corregida.');
      }
      if (motivo.length < 10) {
        throw new EnmiendaCorrectivaInvalidaError(
          `La justificación de una enmienda correctiva debe contener al menos 10 caracteres (recibido: ${motivo.length}).`
        );
      }
    } else {
      if (motivo.length < 5) {
        throw new Error(`El motivo de la revisión debe contener al menos 5 caracteres (recibido: ${motivo.length}).`);
      }
    }

    if (!props.snapshotPiezas || props.snapshotPiezas.length !== 52) {
      throw new Error(
        `El snapshot histórico de la revisión debe contener exactamente 52 piezas FDI (recibido: ${props.snapshotPiezas?.length ?? 0}).`
      );
    }

    this._id = props.id;
    this._odontogramaId = props.odontogramaId;
    this._historiaClinicaId = props.historiaClinicaId;
    this._consultaId = props.consultaId ?? null;
    this._numeroRevision = props.numeroRevision;
    this._tipoRevision = props.tipoRevision;
    this._revisionCorregidaId = props.revisionCorregidaId ?? null;
    this._aplicaAlEstadoActual = Boolean(props.aplicaAlEstadoActual);
    this._fechaRegistro = new Date(props.fechaRegistro.getTime());
    this._fechaObservacionClinica = new Date(props.fechaObservacionClinica.getTime());
    this._registradoPor = props.registradoPor;
    this._motivoRevision = motivo;
    this._cambiosAplicados = Object.freeze([...(props.cambiosAplicados ?? [])]);
    this._snapshotPiezas = Object.freeze(
      props.snapshotPiezas.map((s) => {
        const superficiesObj: Record<string, unknown> = {};
        if (s.superficies) {
          for (const [k, v] of Object.entries(s.superficies)) {
            superficiesObj[k] = Object.freeze({ ...v });
          }
        }
        const tratamientos = (s.tratamientosEstructurales ?? []).map((t) =>
          Object.freeze({
            tipo: t.tipo,
            consultaId: t.consultaId,
            fechaRegistro: new Date(t.fechaRegistro instanceof Date ? t.fechaRegistro.getTime() : t.fechaRegistro),
          })
        );
        return Object.freeze({
          numeroFDI: s.numeroFDI,
          estadoAnatomico: s.estadoAnatomico,
          estadoEvaluacion: s.estadoEvaluacion,
          superficies: Object.freeze(superficiesObj as unknown as typeof s.superficies),
          tratamientosEstructurales: Object.freeze(tratamientos),
          observaciones: s.observaciones,
        });
      })
    );

    Object.freeze(this);
  }

  get id(): RevisionId {
    return this._id;
  }

  get odontogramaId(): OdontogramaId {
    return this._odontogramaId;
  }

  get historiaClinicaId(): HistoriaClinicaId {
    return this._historiaClinicaId;
  }

  get consultaId(): ConsultaId | null {
    return this._consultaId;
  }

  get numeroRevision(): number {
    return this._numeroRevision;
  }

  get tipoRevision(): TipoRevisionOdontograma {
    return this._tipoRevision;
  }

  get esEnmienda(): boolean {
    return this._tipoRevision === TipoRevisionOdontograma.ENMIENDA_CORRECTIVA;
  }

  get revisionCorregidaId(): RevisionId | null {
    return this._revisionCorregidaId;
  }

  get aplicaAlEstadoActual(): boolean {
    return this._aplicaAlEstadoActual;
  }

  get fechaRegistro(): Date {
    return new Date(this._fechaRegistro.getTime()); // Copia defensiva
  }

  get fechaObservacionClinica(): Date {
    return new Date(this._fechaObservacionClinica.getTime()); // Copia defensiva
  }

  get registradoPor(): OdontologoId {
    return this._registradoPor;
  }

  get motivoRevision(): string {
    return this._motivoRevision;
  }

  get cambiosAplicados(): ReadonlyArray<DeltaPiezaOdontograma> {
    return this._cambiosAplicados;
  }

  get snapshotPiezas(): ReadonlyArray<PiezaDentalSnapshotProps> {
    return this._snapshotPiezas;
  }
}
