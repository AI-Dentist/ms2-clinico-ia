import { Inject, Injectable } from '@nestjs/common';
import {
  HISTORIA_CLINICA_REPOSITORY,
  type IHistoriaClinicaRepository,
} from '../../domain/ports/historia-clinica.repository.port.js';
import { PacienteId } from '../../domain/value-objects/paciente-id.vo.js';
import { HistoriaClinicaNoEncontradaError } from '../../domain/errors/historia-clinica-no-encontrada.error.js';
import { HistoriaClinicaMapper } from '../mappers/historia-clinica.mapper.js';
import type { ObtenerHistoriaPorPacienteQuery } from '../queries/obtener-historia-por-paciente.query.js';
import type { HistoriaClinicaResponseDto } from '../dtos/historia-clinica-response.dto.js';

@Injectable()
export class ObtenerHistoriaPorPacienteUseCase {
  constructor(
    @Inject(HISTORIA_CLINICA_REPOSITORY)
    private readonly historiaClinicaRepository: IHistoriaClinicaRepository,
  ) {}

  async execute(query: ObtenerHistoriaPorPacienteQuery): Promise<HistoriaClinicaResponseDto> {
    const pacienteId = PacienteId.crear(query.pacienteId);
    const historia = await this.historiaClinicaRepository.buscarPorPacienteId(pacienteId);

    if (!historia) {
      throw new HistoriaClinicaNoEncontradaError(query.pacienteId);
    }

    return HistoriaClinicaMapper.toResponseDto(historia);
  }
}
