import { HistoriaClinica } from '../../domain/entities/historia-clinica.entity.js';
import { Antecedentes } from '../../domain/value-objects/antecedentes.vo.js';
import { CampoClinico } from '../../domain/value-objects/campo-clinico.vo.js';
import { Alergia } from '../../domain/value-objects/alergia.vo.js';
import { Medicamento } from '../../domain/value-objects/medicamento.vo.js';
import type { EntradaAuditoria } from '../../domain/value-objects/entrada-auditoria.vo.js';
import type {
  AntecedentesInputDto,
  CampoClinicoInputDto,
} from '../dtos/antecedentes-input.dto.js';
import type { AlergiaInputDto } from '../dtos/alergia-input.dto.js';
import type { MedicamentoInputDto } from '../dtos/medicamento-input.dto.js';
import type {
  AlergiaResponseDto,
  AntecedentesResponseDto,
  CampoClinicoResponseDto,
  EntradaAuditoriaResponseDto,
  HistoriaClinicaResponseDto,
  MedicamentoResponseDto,
} from '../dtos/historia-clinica-response.dto.js';

export class HistoriaClinicaMapper {
  static toResponseDto(historia: HistoriaClinica): HistoriaClinicaResponseDto {
    return {
      id: historia.id.valor,
      pacienteId: historia.pacienteId.valor,
      odontologoResponsableId: historia.odontologoResponsableId.valor,
      estado: historia.estado,
      antecedentes: this.toAntecedentesResponseDto(historia.antecedentes),
      alergias: historia.alergias.map((a) => this.toAlergiaResponseDto(a)),
      medicamentosActuales: historia.medicamentosActuales.map((m) =>
        this.toMedicamentoResponseDto(m),
      ),
      observacionesGenerales: historia.observacionesGenerales,
      version: historia.version,
      creadoEn: historia.creadoEn.toISOString(),
      actualizadoEn: historia.actualizadoEn.toISOString(),
      historialCambios: historia.historialCambios.map((h) =>
        this.toEntradaAuditoriaResponseDto(h),
      ),
    };
  }

  static toAntecedentesResponseDto(antecedentes: Antecedentes): AntecedentesResponseDto {
    const od = antecedentes.antecedentesOdontologicos;
    return {
      enfermedadesCronicas: antecedentes.enfermedadesCronicas.map((c) =>
        this.toCampoClinicoResponseDto(c),
      ),
      antecedentesMedicos: antecedentes.antecedentesMedicos.map((c) =>
        this.toCampoClinicoResponseDto(c),
      ),
      antecedentesFamiliares: antecedentes.antecedentesFamiliares.map((c) =>
        this.toCampoClinicoResponseDto(c),
      ),
      antecedentesOdontologicos: {
        tratamientoPrevio: this.toCampoClinicoResponseDto(od.tratamientoPrevio),
        protesisActual: this.toCampoClinicoResponseDto(od.protesisActual),
        sangradoGingival: this.toCampoClinicoResponseDto(od.sangradoGingival),
        bruxismo: this.toCampoClinicoResponseDto(od.bruxismo),
      },
    };
  }

  static toCampoClinicoResponseDto(campo: CampoClinico): CampoClinicoResponseDto {
    return {
      nombre: campo.nombre,
      estado: campo.estado,
      detalle: campo.detalle,
      registradoEn: campo.registradoEn ? campo.registradoEn.toISOString() : null,
    };
  }

  static toAlergiaResponseDto(alergia: Alergia): AlergiaResponseDto {
    return {
      sustancia: alergia.sustancia,
      tipoReaccion: alergia.tipoReaccion,
      severidad: alergia.severidad,
      notasAdicionales: alergia.notasAdicionales,
      registradaEn: alergia.registradaEn.toISOString(),
    };
  }

  static toMedicamentoResponseDto(medicamento: Medicamento): MedicamentoResponseDto {
    return {
      nombre: medicamento.nombre,
      principioActivo: medicamento.principioActivo,
      dosis: medicamento.dosis,
      motivoUso: medicamento.motivoUso,
      prescritoDesde: medicamento.prescritoDesde
        ? medicamento.prescritoDesde.toISOString()
        : null,
    };
  }

  static toEntradaAuditoriaResponseDto(
    entrada: EntradaAuditoria,
  ): EntradaAuditoriaResponseDto {
    return {
      accion: entrada.accion,
      odontologoId: entrada.odontologoId,
      fechaHora: entrada.fechaHora.toISOString(),
      camposModificados: [...entrada.camposModificados],
      descripcion: entrada.descripcion,
    };
  }

  static toAntecedentesEntity(dto: AntecedentesInputDto): Antecedentes {
    const parseCampo = (c?: CampoClinicoInputDto): CampoClinico => {
      if (!c) {
        return CampoClinico.crear({ estado: 'NO_EVALUADO' });
      }
      if (c.estado === 'CONFIRMADO') {
        const registradoEnDate =
          typeof c.registradoEn === 'string'
            ? new Date(c.registradoEn)
            : (c.registradoEn ?? undefined);
        return CampoClinico.crear({
          nombre: c.nombre ?? null,
          estado: 'CONFIRMADO',
          detalle: c.detalle ?? '',
          registradoEn: registradoEnDate,
        });
      }
      return CampoClinico.crear({
        nombre: c.nombre ?? null,
        estado: c.estado,
      });
    };

    const enfermedadesCronicas = (dto.enfermedadesCronicas ?? []).map((c) =>
      parseCampo(c),
    );
    const antecedentesMedicos = (dto.antecedentesMedicos ?? []).map((c) =>
      parseCampo(c),
    );
    const antecedentesFamiliares = (dto.antecedentesFamiliares ?? []).map((c) =>
      parseCampo(c),
    );

    const od = dto.antecedentesOdontologicos;
    return Antecedentes.crear({
      enfermedadesCronicas,
      antecedentesMedicos,
      antecedentesFamiliares,
      antecedentesOdontologicos: {
        tratamientoPrevio: parseCampo(od?.tratamientoPrevio),
        protesisActual: parseCampo(od?.protesisActual),
        sangradoGingival: parseCampo(od?.sangradoGingival),
        bruxismo: parseCampo(od?.bruxismo),
      },
    });
  }

  static toAlergiaEntity(dto: AlergiaInputDto): Alergia {
    const registradaEn =
      typeof dto.registradaEn === 'string'
        ? new Date(dto.registradaEn)
        : (dto.registradaEn ?? undefined);

    return Alergia.crear({
      sustancia: dto.sustancia,
      tipoReaccion: dto.tipoReaccion,
      severidad: dto.severidad,
      notasAdicionales: dto.notasAdicionales ?? null,
      registradaEn,
    });
  }

  static toMedicamentoEntity(dto: MedicamentoInputDto): Medicamento {
    const prescritoDesde =
      typeof dto.prescritoDesde === 'string'
        ? new Date(dto.prescritoDesde)
        : (dto.prescritoDesde ?? null);

    return Medicamento.crear({
      nombre: dto.nombre,
      principioActivo: dto.principioActivo ?? null,
      dosis: dto.dosis,
      motivoUso: dto.motivoUso ?? null,
      prescritoDesde,
    });
  }
}

