import { ConsultaOdontologica } from '../../../../domain/entities/consulta-odontologica.entity.js';
import { ConsultaId } from '../../../../domain/value-objects/consulta-id.vo.js';
import { HistoriaClinicaId } from '../../../../domain/value-objects/historia-clinica-id.vo.js';
import { PacienteId } from '../../../../domain/value-objects/paciente-id.vo.js';
import { OdontologoId } from '../../../../domain/value-objects/odontologo-id.vo.js';
import { CitaId } from '../../../../domain/value-objects/cita-id.vo.js';
import { MotivoConsulta } from '../../../../domain/value-objects/motivo-consulta.vo.js';
import { AnamnesisActual } from '../../../../domain/value-objects/anamnesis-actual.vo.js';
import { ExploracionFisica } from '../../../../domain/value-objects/exploracion-fisica.vo.js';
import { DiagnosticoItem } from '../../../../domain/value-objects/diagnostico-item.vo.js';
import { ProcedimientoRealizado } from '../../../../domain/value-objects/procedimiento-realizado.vo.js';
import { PiezaDentalFDI } from '../../../../domain/value-objects/pieza-dental-fdi.vo.js';
import { EvolucionSOAP } from '../../../../domain/value-objects/evolucion-soap.vo.js';
import { SnapshotRiesgoClinico } from '../../../../domain/value-objects/snapshot-riesgo-clinico.vo.js';
import type { ConsultaOdontologicaDocument } from '../schemas/consulta-odontologica.schema.js';

export class ConsultaOdontologicaMongoMapper {
  static toPersistence(consulta: ConsultaOdontologica): ConsultaOdontologicaDocument {
    const snapshot = consulta.snapshotRiesgoClinico;

    return {
      _id: consulta.id.valor,
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
        capturadoEn: snapshot.capturadoEn,
      },
      fechaAtencion: consulta.fechaAtencion,
      cerradaEn: consulta.cerradaEn,
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
      creadoEn: consulta.creadoEn,
      actualizadoEn: consulta.actualizadoEn,
      creadoPor: consulta.creadoPor.valor,
      actualizadoPor: consulta.actualizadoPor.valor,
    };
  }

  static toDomain(doc: ConsultaOdontologicaDocument): ConsultaOdontologica {
    const alergiasSnapshot = (doc.snapshotRiesgoClinico?.alergiasCriticas ?? []).map((a) => ({
      sustancia: a.sustancia,
      severidad: a.severidad,
    }));

    const snapshot = SnapshotRiesgoClinico.reconstituir({
      alergiasCriticas: alergiasSnapshot,
      condicionesMedicas: doc.snapshotRiesgoClinico?.condicionesMedicas ?? [],
      medicacionHabitual: doc.snapshotRiesgoClinico?.medicacionHabitual ?? [],
      capturadoEn: doc.snapshotRiesgoClinico?.capturadoEn,
    });

    const diagnosticos = (doc.diagnosticos ?? []).map((d) =>
      DiagnosticoItem.reconstituir({
        codigoCIE10: d.codigoCIE10,
        descripcion: d.descripcion,
        tipo: d.tipo,
      })
    );

    const procedimientos = (doc.procedimientosRealizados ?? []).map((p) =>
      ProcedimientoRealizado.reconstituir({
        codigo: p.codigo,
        descripcion: p.descripcion,
        piezaDental:
          p.piezaDental !== undefined && p.piezaDental !== null
            ? PiezaDentalFDI.reconstituir(p.piezaDental)
            : null,
        observaciones: p.observaciones,
      })
    );

    return ConsultaOdontologica.reconstituir({
      id: ConsultaId.reconstituir(doc._id),
      historiaClinicaId: HistoriaClinicaId.reconstituir(doc.historiaClinicaId),
      pacienteId: PacienteId.reconstituir(doc.pacienteId),
      odontologoId: OdontologoId.reconstituir(doc.odontologoId),
      citaId: doc.citaId ? CitaId.reconstituir(doc.citaId) : null,
      versionHistoriaReferenciada: doc.versionHistoriaReferenciada,
      snapshotRiesgoClinico: snapshot,
      fechaAtencion: doc.fechaAtencion,
      cerradaEn: doc.cerradaEn ?? null,
      estado: doc.estado,
      motivoConsulta: MotivoConsulta.reconstituir(doc.motivoConsulta),
      anamnesisActual: AnamnesisActual.reconstituir({
        descripcion: doc.anamnesisActual?.descripcion ?? '',
        tiempoEvolucion: doc.anamnesisActual?.tiempoEvolucion ?? null,
        escalaDolorEVA: doc.anamnesisActual?.escalaDolorEVA ?? null,
      }),
      exploracionFisica: ExploracionFisica.reconstituir({
        inspeccionExtraoral: doc.exploracionFisica?.inspeccionExtraoral ?? null,
        inspeccionIntraoral: doc.exploracionFisica?.inspeccionIntraoral ?? '',
        hallazgosDentales: doc.exploracionFisica?.hallazgosDentales ?? null,
      }),
      diagnosticos,
      procedimientosRealizados: procedimientos,
      evolucionSOAP: EvolucionSOAP.reconstituir({
        subjetivo: doc.evolucionSOAP?.subjetivo ?? null,
        objetivo: doc.evolucionSOAP?.objetivo ?? null,
        analisis: doc.evolucionSOAP?.analisis ?? null,
        plan: doc.evolucionSOAP?.plan ?? null,
      }),
      recomendaciones: doc.recomendaciones ?? null,
      motivoCancelacion: doc.motivoCancelacion ?? null,
      version: doc.version,
      creadoEn: doc.creadoEn,
      actualizadoEn: doc.actualizadoEn,
      creadoPor: OdontologoId.reconstituir(doc.creadoPor),
      actualizadoPor: OdontologoId.reconstituir(doc.actualizadoPor),
    });
  }
}
