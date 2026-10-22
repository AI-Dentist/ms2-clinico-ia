import type { EstadoHistoria } from '../../domain/value-objects/estado-historia.enum.js';
import type { AccionAuditoria } from '../../domain/value-objects/accion-auditoria.enum.js';
import type { SeveridadAlergia } from '../../domain/value-objects/severidad-alergia.enum.js';
import type { EstadoEpistemico } from '../../domain/value-objects/campo-clinico.vo.js';

export interface CampoClinicoResponseDto {
  nombre: string | null;
  estado: EstadoEpistemico;
  detalle: string | null;
  registradoEn: string | null;
}

export interface AntecedentesOdontologicosResponseDto {
  tratamientoPrevio: CampoClinicoResponseDto;
  protesisActual: CampoClinicoResponseDto;
  sangradoGingival: CampoClinicoResponseDto;
  bruxismo: CampoClinicoResponseDto;
}

export interface AntecedentesResponseDto {
  enfermedadesCronicas: CampoClinicoResponseDto[];
  antecedentesMedicos: CampoClinicoResponseDto[];
  antecedentesFamiliares: CampoClinicoResponseDto[];
  antecedentesOdontologicos: AntecedentesOdontologicosResponseDto;
}

export interface AlergiaResponseDto {
  sustancia: string;
  tipoReaccion: string;
  severidad: SeveridadAlergia;
  notasAdicionales: string | null;
  registradaEn: string;
}

export interface MedicamentoResponseDto {
  nombre: string;
  principioActivo: string | null;
  dosis: string;
  motivoUso: string | null;
  prescritoDesde: string | null;
}

export interface EntradaAuditoriaResponseDto {
  accion: AccionAuditoria;
  odontologoId: string;
  fechaHora: string;
  camposModificados: string[];
  descripcion: string | null;
}

export interface HistoriaClinicaResponseDto {
  id: string;
  pacienteId: string;
  odontologoResponsableId: string;
  estado: EstadoHistoria;
  antecedentes: AntecedentesResponseDto;
  alergias: AlergiaResponseDto[];
  medicamentosActuales: MedicamentoResponseDto[];
  observacionesGenerales: string | null;
  version: number;
  creadoEn: string;
  actualizadoEn: string;
  historialCambios: EntradaAuditoriaResponseDto[];
}
