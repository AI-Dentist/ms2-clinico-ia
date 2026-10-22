import { Inject, Injectable } from '@nestjs/common';
import {
  HISTORIA_CLINICA_REPOSITORY,
  type IHistoriaClinicaRepository,
} from '../../domain/ports/historia-clinica.repository.port.js';
import { HistoriaClinicaId } from '../../domain/value-objects/historia-clinica-id.vo.js';
import { HistoriaClinicaNoEncontradaError } from '../../domain/errors/historia-clinica-no-encontrada.error.js';
import { HistoriaClinicaMapper } from '../mappers/historia-clinica.mapper.js';
import type { ObtenerHistoriaPorIdQuery } from '../queries/obtener-historia-por-id.query.js';
import type { HistoriaClinicaResponseDto } from '../dtos/historia-clinica-response.dto.js';

@Injectable()
export class ObtenerHistoriaPorIdUseCase {
  constructor(
    @Inject(HISTORIA_CLINICA_REPOSITORY)
    private readonly historiaClinicaRepository: IHistoriaClinicaRepository,
  ) {}

  async execute(query: ObtenerHistoriaPorIdQuery): Promise<HistoriaClinicaResponseDto> {
    const historiaId = HistoriaClinicaId.reconstituir(query.id);
    const historia = await this.historiaClinicaRepository.buscarPorId(historiaId);

    if (!historia) {
      throw new HistoriaClinicaNoEncontradaError(query.id);
    }

    return HistoriaClinicaMapper.toResponseDto(historia);
  }
}
