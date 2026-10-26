import type { Odontograma } from '../../domain/entities/odontograma.entity.js';
import type { PiezaDentalSnapshotProps } from '../../domain/entities/pieza-dental-odontograma.entity.js';
import type { RevisionOdontograma } from '../../domain/entities/revision-odontograma.entity.js';
import type { OdontogramaActualDto } from '../dtos/odontograma-actual.dto.js';
import type { PiezaDentalDto, SuperficieDentalDto, TratamientoEstructuralDto } from '../dtos/pieza-dental.dto.js';
import type { RevisionOdontogramaDto, DeltaPiezaDto } from '../dtos/revision-odontograma.dto.js';

export class OdontogramaMapper {
  /**
   * Mapea un snapshot inmutable de pieza dental hacia PiezaDentalDto.
   */
  static snapshotPiezaToDto(snapshot: PiezaDentalSnapshotProps): PiezaDentalDto {
    const superficiesDto: Record<string, SuperficieDentalDto> = {};
    for (const [key, val] of Object.entries(snapshot.superficies)) {
      superficiesDto[key] = {
        superficie: val.superficie,
        condicion: val.condicion,
        evaluada: val.evaluada,
      };
    }

    const tratamientosDto: TratamientoEstructuralDto[] = snapshot.tratamientosEstructurales.map((t) => ({
      tipo: t.tipo,
      consultaId: t.consultaId,
      fechaRegistro: t.fechaRegistro instanceof Date ? t.fechaRegistro.toISOString() : new Date(t.fechaRegistro).toISOString(),
    }));

    return {
      numeroFDI: snapshot.numeroFDI,
      estadoAnatomico: snapshot.estadoAnatomico,
      estadoEvaluacion: snapshot.estadoEvaluacion,
      superficies: superficiesDto,
      tratamientosEstructurales: tratamientosDto,
      observaciones: snapshot.observaciones,
    };
  }

  /**
   * Mapea el estado consolidado vigente del Aggregate Root Odontograma a su DTO de lectura.
   */
  static toActualDto(odontograma: Odontograma): OdontogramaActualDto {
    const snapshots = odontograma.obtenerSnapshot();
    const piezasDto = snapshots.map((s) => OdontogramaMapper.snapshotPiezaToDto(s));

    return {
      id: odontograma.id.valor,
      historiaClinicaId: odontograma.historiaClinicaId.valor,
      pacienteId: odontograma.pacienteId.valor,
      revisionActualId: odontograma.revisionActualId.valor,
      totalRevisiones: odontograma.totalRevisiones,
      version: odontograma.version,
      creadoEn: odontograma.creadoEn.toISOString(),
      actualizadoEn: odontograma.actualizadoEn.toISOString(),
      actualizadoPor: odontograma.actualizadoPor.valor,
      piezas: piezasDto,
    };
  }

  /**
   * Mapea una entidad RevisionOdontograma sellada a su DTO inmutable.
   */
  static revisionToDto(revision: RevisionOdontograma): RevisionOdontogramaDto {
    const deltasDto: DeltaPiezaDto[] = revision.cambiosAplicados.map((d) => ({
      numeroFDI: d.numeroFDI,
      estadoAnatomicoAnterior: d.estadoAnatomicoAnterior,
      estadoAnatomicoNuevo: d.estadoAnatomicoNuevo,
      superficiesModificadas: d.superficiesModificadas.map((s) => ({
        superficie: s.superficie,
        condicionAnterior: s.condicionAnterior,
        condicionNueva: s.condicionNueva,
      })),
      tratamientoEstructuralAgregado: d.tratamientoEstructuralAgregado,
      observaciones: d.observaciones,
    }));

    const snapshotsDto: PiezaDentalDto[] = revision.snapshotPiezas.map((s) =>
      OdontogramaMapper.snapshotPiezaToDto(s)
    );

    return {
      id: revision.id.valor,
      odontogramaId: revision.odontogramaId.valor,
      historiaClinicaId: revision.historiaClinicaId.valor,
      consultaId: revision.consultaId ? revision.consultaId.valor : null,
      numeroRevision: revision.numeroRevision,
      tipoRevision: revision.tipoRevision,
      revisionCorregidaId: revision.revisionCorregidaId ? revision.revisionCorregidaId.valor : null,
      aplicaAlEstadoActual: revision.aplicaAlEstadoActual,
      fechaRegistro: revision.fechaRegistro.toISOString(),
      fechaObservacionClinica: revision.fechaObservacionClinica.toISOString(),
      registradoPor: revision.registradoPor.valor,
      motivoRevision: revision.motivoRevision,
      cambiosAplicados: deltasDto,
      snapshotPiezas: snapshotsDto,
    };
  }
}
