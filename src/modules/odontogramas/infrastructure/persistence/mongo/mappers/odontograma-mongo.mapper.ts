import { Odontograma } from '../../../../domain/entities/odontograma.entity.js';
import {
  PiezaDentalOdontograma,
  type PiezaDentalSnapshotProps,
} from '../../../../domain/entities/pieza-dental-odontograma.entity.js';
import { RevisionOdontograma } from '../../../../domain/entities/revision-odontograma.entity.js';
import { OdontogramaId } from '../../../../domain/value-objects/odontograma-id.vo.js';
import { RevisionId } from '../../../../domain/value-objects/revision-id.vo.js';
import { HistoriaClinicaId } from '../../../../../historias-clinicas/domain/value-objects/historia-clinica-id.vo.js';
import { PacienteId } from '../../../../../historias-clinicas/domain/value-objects/paciente-id.vo.js';
import { OdontologoId } from '../../../../../historias-clinicas/domain/value-objects/odontologo-id.vo.js';
import { ConsultaId } from '../../../../../consultas-odontologicas/domain/value-objects/consulta-id.vo.js';
import { DeltaPiezaOdontograma } from '../../../../domain/value-objects/delta-pieza-odontograma.vo.js';
import type { TipoSuperficie } from '../../../../domain/value-objects/tipo-superficie.enum.js';
import type { CondicionSuperficie } from '../../../../domain/value-objects/condicion-superficie.enum.js';
import type { OdontogramaDocument } from '../schemas/odontograma.schema.js';
import type { RevisionOdontogramaDocument } from '../schemas/revision-odontograma.schema.js';
import type { PiezaDentalDocument } from '../schemas/pieza-dental.schema.js';
import type { DeltaPiezaDocument } from '../schemas/delta-pieza.schema.js';

export class OdontogramaMongoMapper {
  // ─── Piezas Dentales <-> Persistencia ───────────────────────────────────────

  static piezaToPersistence(snapshot: PiezaDentalSnapshotProps): PiezaDentalDocument {
    const superficiesMap = new Map<string, any>();
    for (const [key, val] of Object.entries(snapshot.superficies)) {
      superficiesMap.set(key, {
        superficie: val.superficie,
        condicion: val.condicion,
        evaluada: val.evaluada,
      });
    }

    return {
      numeroFDI: snapshot.numeroFDI,
      estadoAnatomico: snapshot.estadoAnatomico,
      estadoEvaluacion: snapshot.estadoEvaluacion,
      superficies: superficiesMap,
      tratamientosEstructurales: snapshot.tratamientosEstructurales.map((t: { tipo: any; consultaId: any; fechaRegistro: any }) => ({
        tipo: t.tipo,
        consultaId: t.consultaId,
        fechaRegistro: new Date(t.fechaRegistro),
      })),
      observaciones: snapshot.observaciones,
    };
  }

  static piezaToDomainSnapshot(doc: PiezaDentalDocument): PiezaDentalSnapshotProps {
    const superficiesObj = {} as Record<
      TipoSuperficie,
      { superficie: TipoSuperficie; condicion: CondicionSuperficie; evaluada: boolean }
    >;

    if (doc.superficies instanceof Map) {
      for (const [key, val] of doc.superficies.entries()) {
        superficiesObj[key as TipoSuperficie] = {
          superficie: val.superficie,
          condicion: val.condicion,
          evaluada: val.evaluada,
        };
      }
    } else if (doc.superficies && typeof doc.superficies === 'object') {
      for (const [key, val] of Object.entries(doc.superficies)) {
        superficiesObj[key as TipoSuperficie] = {
          superficie: (val as any).superficie,
          condicion: (val as any).condicion,
          evaluada: (val as any).evaluada,
        };
      }
    }

    return {
      numeroFDI: doc.numeroFDI,
      estadoAnatomico: doc.estadoAnatomico,
      estadoEvaluacion: doc.estadoEvaluacion,
      superficies: superficiesObj,
      tratamientosEstructurales: (doc.tratamientosEstructurales || []).map((t: any) => ({
        tipo: t.tipo,
        consultaId: t.consultaId ?? null,
        fechaRegistro: new Date(t.fechaRegistro),
      })),
      observaciones: doc.observaciones ?? null,
    };
  }

  // ─── Odontograma Aggregate Root <-> Persistencia ──────────────────────────

  static odontogramaToPersistence(odontograma: Odontograma): OdontogramaDocument {
    const snapshots = odontograma.obtenerSnapshot();
    const piezasDoc = snapshots.map((s: PiezaDentalSnapshotProps) => OdontogramaMongoMapper.piezaToPersistence(s));

    return {
      _id: odontograma.id.valor,
      historiaClinicaId: odontograma.historiaClinicaId.valor,
      pacienteId: odontograma.pacienteId.valor,
      piezas: piezasDoc,
      revisionActualId: odontograma.revisionActualId.valor,
      totalRevisiones: odontograma.totalRevisiones,
      version: odontograma.version,
      creadoEn: new Date(odontograma.creadoEn.getTime()),
      actualizadoEn: new Date(odontograma.actualizadoEn.getTime()),
      actualizadoPor: odontograma.actualizadoPor.valor,
    };
  }

  static odontogramaToDomain(doc: OdontogramaDocument): Odontograma {
    if (!doc.piezas || doc.piezas.length !== 52) {
      throw new Error(
        `Error de persistencia: El odontograma '${doc._id}' debe contener exactamente 52 posiciones FDI (recibido: ${doc.piezas?.length ?? 0}).`
      );
    }

    const piezasMap = new Map<number, PiezaDentalOdontograma>();
    for (const piezaDoc of doc.piezas) {
      const snapshot = OdontogramaMongoMapper.piezaToDomainSnapshot(piezaDoc);
      piezasMap.set(snapshot.numeroFDI, PiezaDentalOdontograma.desdeSnapshot(snapshot));
    }

    return Odontograma.reconstituir({
      id: OdontogramaId.reconstituir(doc._id),
      historiaClinicaId: HistoriaClinicaId.reconstituir(doc.historiaClinicaId),
      pacienteId: PacienteId.crear(doc.pacienteId),
      piezas: piezasMap,
      revisionActualId: RevisionId.reconstituir(doc.revisionActualId),
      totalRevisiones: doc.totalRevisiones,
      version: doc.version,
      creadoEn: new Date(doc.creadoEn),
      actualizadoEn: new Date(doc.actualizadoEn),
      actualizadoPor: OdontologoId.crear(doc.actualizadoPor),
    });
  }

  // ─── RevisionOdontograma <-> Persistencia ─────────────────────────────────

  static revisionToPersistence(revision: RevisionOdontograma): RevisionOdontogramaDocument {
    const deltasDoc: DeltaPiezaDocument[] = revision.cambiosAplicados.map((d) => ({
      numeroFDI: d.numeroFDI,
      estadoAnatomicoAnterior: d.estadoAnatomicoAnterior,
      estadoAnatomicoNuevo: d.estadoAnatomicoNuevo,
      superficiesModificadas: d.superficiesModificadas.map((s: { superficie: any; condicionAnterior: any; condicionNueva: any }) => ({
        superficie: s.superficie,
        condicionAnterior: s.condicionAnterior,
        condicionNueva: s.condicionNueva,
      })),
      tratamientoEstructuralAgregado: d.tratamientoEstructuralAgregado,
      observaciones: d.observaciones,
    }));

    const snapshotsDoc = revision.snapshotPiezas.map((s: PiezaDentalSnapshotProps) =>
      OdontogramaMongoMapper.piezaToPersistence(s)
    );

    return {
      _id: revision.id.valor,
      odontogramaId: revision.odontogramaId.valor,
      historiaClinicaId: revision.historiaClinicaId.valor,
      consultaId: revision.consultaId ? revision.consultaId.valor : null,
      numeroRevision: revision.numeroRevision,
      tipoRevision: revision.tipoRevision,
      revisionCorregidaId: revision.revisionCorregidaId ? revision.revisionCorregidaId.valor : null,
      aplicaAlEstadoActual: revision.aplicaAlEstadoActual,
      fechaRegistro: new Date(revision.fechaRegistro.getTime()),
      fechaObservacionClinica: new Date(revision.fechaObservacionClinica.getTime()),
      registradoPor: revision.registradoPor.valor,
      motivoRevision: revision.motivoRevision,
      cambiosAplicados: deltasDoc,
      snapshotPiezas: snapshotsDoc,
    };
  }

  static revisionToDomain(doc: RevisionOdontogramaDocument): RevisionOdontograma {
    if (!doc.snapshotPiezas || doc.snapshotPiezas.length !== 52) {
      throw new Error(
        `Error de persistencia: El snapshot de la revisión '${doc._id}' debe contener exactamente 52 posiciones FDI (recibido: ${doc.snapshotPiezas?.length ?? 0}).`
      );
    }

    const deltas = (doc.cambiosAplicados || []).map(
      (d) =>
        new DeltaPiezaOdontograma({
          numeroFDI: d.numeroFDI,
          estadoAnatomicoAnterior: d.estadoAnatomicoAnterior,
          estadoAnatomicoNuevo: d.estadoAnatomicoNuevo,
          superficiesModificadas: (d.superficiesModificadas || []).map((s: any) => ({
            superficie: s.superficie,
            condicionAnterior: s.condicionAnterior,
            condicionNueva: s.condicionNueva,
          })),
          tratamientoEstructuralAgregado: d.tratamientoEstructuralAgregado,
          observaciones: d.observaciones,
        })
    );

    const snapshots = doc.snapshotPiezas.map((p: PiezaDentalDocument) =>
      OdontogramaMongoMapper.piezaToDomainSnapshot(p)
    );

    return new RevisionOdontograma({
      id: RevisionId.reconstituir(doc._id),
      odontogramaId: OdontogramaId.reconstituir(doc.odontogramaId),
      historiaClinicaId: HistoriaClinicaId.reconstituir(doc.historiaClinicaId),
      consultaId: doc.consultaId ? ConsultaId.reconstituir(doc.consultaId) : null,
      numeroRevision: doc.numeroRevision,
      tipoRevision: doc.tipoRevision,
      revisionCorregidaId: doc.revisionCorregidaId
        ? RevisionId.reconstituir(doc.revisionCorregidaId)
        : null,
      aplicaAlEstadoActual: doc.aplicaAlEstadoActual,
      fechaRegistro: new Date(doc.fechaRegistro),
      fechaObservacionClinica: new Date(doc.fechaObservacionClinica),
      registradoPor: OdontologoId.crear(doc.registradoPor),
      motivoRevision: doc.motivoRevision,
      cambiosAplicados: deltas,
      snapshotPiezas: snapshots,
    });
  }
}
