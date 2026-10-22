import type { ConsultaOdontologica } from '../../domain/entities/consulta-odontologica.entity.js';
import type { ConsultaOdontologicaResponseDto } from '../dtos/consulta-odontologica-response.dto.js';

/**
 * Mapper que transforma la entidad raíz de dominio ConsultaOdontologica
 * al Data Transfer Object ConsultaOdontologicaResponseDto sin exponer referencias mutables.
 */
export class ConsultaOdontologicaMapper {
  static toResponseDto(consulta: ConsultaOdontologica): ConsultaOdontologicaResponseDto {
    const snapshot = consulta.snapshotRiesgoClinico;

    return {
      id: consulta.id.valor,
      historiaClinicaId: consulta.historiaClinicaId.valor,
      pacienteId: consulta.pacienteId.valor,
      odontologoId: consulta.odontologoId.valor,
      citaId: consulta.citaId ? consulta.citaId.valor : null,
      versionHistoriaReferenciada: consulta.versionHistoriaReferenciada,
      snapshotRiesgoClinico: {
        alergiasCriticas: snapshot.alergiasCriticas.map((a) => ({
          sustancia: a.sustancia,
          severidad: a.severidad,
        })),
        condicionesMedicas: [...snapshot.condicionesMedicas],
        medicacionHabitual: [...snapshot.medicacionHabitual],
        capturadoEn: snapshot.capturadoEn.toISOString(),
      },
      fechaAtencion: consulta.fechaAtencion.toISOString(),
      cerradaEn: consulta.cerradaEn ? consulta.cerradaEn.toISOString() : null,
      estado: consulta.estado,
      motivoConsulta: consulta.motivoConsulta.valor,
      anamnesisActual: {
        descripcion: consulta.anamnesisActual.descripcion,
        tiempoEvolucion: consulta.anamnesisActual.tiempoEvolucion,
        escalaDolorEVA: consulta.anamnesisActual.escalaDolorEVA,
      },
      exploracionFisica: {
        inspeccionExtraoral: consulta.exploracionFisica.inspeccionExtraoral,
        inspeccionIntraoral: consulta.exploracionFisica.inspeccionIntraoral,
        hallazgosDentales: consulta.exploracionFisica.hallazgosDentales,
      },
      diagnosticos: consulta.diagnosticos.map((d) => ({
        codigoCIE10: d.codigoCIE10,
        descripcion: d.descripcion,
        tipo: d.tipo,
      })),
      procedimientosRealizados: consulta.procedimientosRealizados.map((p) => ({
        codigo: p.codigo,
        descripcion: p.descripcion,
        piezaDental: p.piezaDental ? p.piezaDental.valor : null,
        observaciones: p.observaciones,
      })),
      evolucionSOAP: {
        subjetivo: consulta.evolucionSOAP.subjetivo,
        objetivo: consulta.evolucionSOAP.objetivo,
        analisis: consulta.evolucionSOAP.analisis,
        plan: consulta.evolucionSOAP.plan,
      },
      recomendaciones: consulta.recomendaciones,
      motivoCancelacion: consulta.motivoCancelacion,
      version: consulta.version,
      creadoEn: consulta.creadoEn.toISOString(),
      actualizadoEn: consulta.actualizadoEn.toISOString(),
      creadoPor: consulta.creadoPor.valor,
      actualizadoPor: consulta.actualizadoPor.valor,
    };
  }
}
