import { HistoriaClinica } from '../../../../domain/entities/historia-clinica.entity.js';
import { HistoriaClinicaId } from '../../../../domain/value-objects/historia-clinica-id.vo.js';
import { PacienteId } from '../../../../domain/value-objects/paciente-id.vo.js';
import { OdontologoId } from '../../../../domain/value-objects/odontologo-id.vo.js';
import { Antecedentes } from '../../../../domain/value-objects/antecedentes.vo.js';
import { CampoClinico } from '../../../../domain/value-objects/campo-clinico.vo.js';
import { Alergia } from '../../../../domain/value-objects/alergia.vo.js';
import { Medicamento } from '../../../../domain/value-objects/medicamento.vo.js';
import { EntradaAuditoria } from '../../../../domain/value-objects/entrada-auditoria.vo.js';
import type {
  HistoriaClinicaDocument,
} from '../schemas/historia-clinica.schema.js';
import type { CampoClinicoDocument } from '../schemas/campo-clinico.schema.js';

export class HistoriaClinicaMongoMapper {
  static toDomain(doc: HistoriaClinicaDocument): HistoriaClinica {
    const antecedentesOd = doc.antecedentes.antecedentesOdontologicos;

    const antecedentes = Antecedentes.crear({
      enfermedadesCronicas: (doc.antecedentes.enfermedadesCronicas ?? []).map((c) =>
        this.toCampoClinicoDomain(c),
      ),
      antecedentesMedicos: (doc.antecedentes.antecedentesMedicos ?? []).map((c) =>
        this.toCampoClinicoDomain(c),
      ),
      antecedentesFamiliares: (doc.antecedentes.antecedentesFamiliares ?? []).map((c) =>
        this.toCampoClinicoDomain(c),
      ),
      antecedentesOdontologicos: {
        tratamientoPrevio: this.toCampoClinicoDomain(antecedentesOd?.tratamientoPrevio),
        protesisActual: this.toCampoClinicoDomain(antecedentesOd?.protesisActual),
        sangradoGingival: this.toCampoClinicoDomain(antecedentesOd?.sangradoGingival),
        bruxismo: this.toCampoClinicoDomain(antecedentesOd?.bruxismo),
      },
    });

    const alergias = (doc.alergias ?? []).map((a) =>
      Alergia.crear({
        sustancia: a.sustancia,
        tipoReaccion: a.tipoReaccion,
        severidad: a.severidad,
        notasAdicionales: a.notasAdicionales,
        registradaEn: a.registradaEn,
      }),
    );

    const medicamentosActuales = (doc.medicamentosActuales ?? []).map((m) =>
      Medicamento.crear({
        nombre: m.nombre,
        principioActivo: m.principioActivo,
        dosis: m.dosis,
        motivoUso: m.motivoUso,
        prescritoDesde: m.prescritoDesde,
      }),
    );

    const historialCambios = (doc.historialCambios ?? []).map((e) =>
      EntradaAuditoria.crear({
        accion: e.accion,
        odontologoId: OdontologoId.crear(e.odontologoId),
        fechaHora: e.fechaHora,
        camposModificados: [...e.camposModificados],
        descripcion: e.descripcion,
      }),
    );

    return HistoriaClinica.reconstituir({
      id: HistoriaClinicaId.reconstituir(doc._id),
      pacienteId: PacienteId.crear(doc.pacienteId),
      odontologoResponsableId: OdontologoId.crear(doc.odontologoResponsableId),
      estado: doc.estado,
      antecedentes,
      alergias,
      medicamentosActuales,
      observacionesGenerales: doc.observacionesGenerales,
      version: doc.version,
      creadoEn: doc.creadoEn,
      actualizadoEn: doc.actualizadoEn,
      historialCambios,
    });
  }

  static toPersistence(historia: HistoriaClinica): Record<string, unknown> {
    const od = historia.antecedentes.antecedentesOdontologicos;

    return {
      _id: historia.id.valor,
      pacienteId: historia.pacienteId.valor,
      odontologoResponsableId: historia.odontologoResponsableId.valor,
      estado: historia.estado,
      antecedentes: {
        enfermedadesCronicas: historia.antecedentes.enfermedadesCronicas.map((c) =>
          this.toCampoClinicoPersistence(c),
        ),
        antecedentesMedicos: historia.antecedentes.antecedentesMedicos.map((c) =>
          this.toCampoClinicoPersistence(c),
        ),
        antecedentesFamiliares: historia.antecedentes.antecedentesFamiliares.map((c) =>
          this.toCampoClinicoPersistence(c),
        ),
        antecedentesOdontologicos: {
          tratamientoPrevio: this.toCampoClinicoPersistence(od.tratamientoPrevio),
          protesisActual: this.toCampoClinicoPersistence(od.protesisActual),
          sangradoGingival: this.toCampoClinicoPersistence(od.sangradoGingival),
          bruxismo: this.toCampoClinicoPersistence(od.bruxismo),
        },
      },
      alergias: historia.alergias.map((a) => this.toAlergiaPersistence(a)),
      medicamentosActuales: historia.medicamentosActuales.map((m) =>
        this.toMedicamentoPersistence(m),
      ),
      observacionesGenerales: historia.observacionesGenerales,
      version: historia.version,
      creadoEn: historia.creadoEn,
      actualizadoEn: historia.actualizadoEn,
      historialCambios: historia.historialCambios.map((h) =>
        this.toEntradaAuditoriaPersistence(h),
      ),
    };
  }

  private static toCampoClinicoDomain(
    c?: CampoClinicoDocument | null,
  ): CampoClinico {
    if (!c) {
      return CampoClinico.crear({ estado: 'NO_EVALUADO' });
    }
    if (c.estado === 'CONFIRMADO') {
      return CampoClinico.crear({
        nombre: c.nombre,
        estado: 'CONFIRMADO',
        detalle: c.detalle ?? '',
        registradoEn: c.registradoEn ?? undefined,
      });
    }
    return CampoClinico.crear({
      nombre: c.nombre,
      estado: c.estado,
    });
  }

  private static toCampoClinicoPersistence(
    c: CampoClinico,
  ): Record<string, unknown> {
    return {
      nombre: c.nombre,
      estado: c.estado,
      detalle: c.detalle,
      registradoEn: c.registradoEn,
    };
  }

  private static toAlergiaPersistence(a: Alergia): Record<string, unknown> {
    return {
      sustancia: a.sustancia,
      tipoReaccion: a.tipoReaccion,
      severidad: a.severidad,
      notasAdicionales: a.notasAdicionales,
      registradaEn: a.registradaEn,
    };
  }

  private static toMedicamentoPersistence(
    m: Medicamento,
  ): Record<string, unknown> {
    return {
      nombre: m.nombre,
      principioActivo: m.principioActivo,
      dosis: m.dosis,
      motivoUso: m.motivoUso,
      prescritoDesde: m.prescritoDesde,
    };
  }

  private static toEntradaAuditoriaPersistence(
    h: EntradaAuditoria,
  ): Record<string, unknown> {
    return {
      accion: h.accion,
      odontologoId: h.odontologoId,
      fechaHora: h.fechaHora,
      camposModificados: [...h.camposModificados],
      descripcion: h.descripcion,
    };
  }
}
