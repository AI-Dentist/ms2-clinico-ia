import type { EstadoEpistemico } from '../../domain/value-objects/campo-clinico.vo.js';

export interface CampoClinicoInputDto {
  nombre?: string | null;
  estado: EstadoEpistemico;
  detalle?: string | null;
  registradoEn?: Date | string | null;
}

export interface AntecedentesOdontologicosInputDto {
  tratamientoPrevio?: CampoClinicoInputDto;
  protesisActual?: CampoClinicoInputDto;
  sangradoGingival?: CampoClinicoInputDto;
  bruxismo?: CampoClinicoInputDto;
}

export interface AntecedentesInputDto {
  enfermedadesCronicas?: CampoClinicoInputDto[];
  antecedentesMedicos?: CampoClinicoInputDto[];
  antecedentesFamiliares?: CampoClinicoInputDto[];
  antecedentesOdontologicos?: AntecedentesOdontologicosInputDto;
}
