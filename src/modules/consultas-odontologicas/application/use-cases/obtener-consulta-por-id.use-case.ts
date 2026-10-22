import { Inject, Injectable } from '@nestjs/common';
import {
  CONSULTA_ODONTOLOGICA_REPOSITORY,
  type IConsultaOdontologicaRepositoryPort,
} from '../../domain/ports/consulta-odontologica.repository.port.js';
import {
  ODONTOLOGO_CONTEXT_PORT,
  type IOdontologoContextPort,
} from '../../domain/ports/odontologo-context.port.js';
import { ConsultaId } from '../../domain/value-objects/consulta-id.vo.js';
import { ConsultaNoEncontradaError } from '../../domain/errors/consulta-no-encontrada.error.js';
import { AutenticacionRequeridaError } from '../errors/autenticacion-requerida.error.js';
import { ConsultaOdontologicaMapper } from '../mappers/consulta-odontologica.mapper.js';
import type { ObtenerConsultaPorIdQuery } from '../queries/obtener-consulta-por-id.query.js';
import type { ConsultaOdontologicaResponseDto } from '../dtos/consulta-odontologica-response.dto.js';

@Injectable()
export class ObtenerConsultaPorIdUseCase {
  constructor(
    @Inject(CONSULTA_ODONTOLOGICA_REPOSITORY)
    private readonly consultaRepository: IConsultaOdontologicaRepositoryPort,
    @Inject(ODONTOLOGO_CONTEXT_PORT)
    private readonly odontologoContextPort: IOdontologoContextPort
  ) {}

  async execute(query: ObtenerConsultaPorIdQuery): Promise<ConsultaOdontologicaResponseDto> {
    if (!query.tokenAutenticacion?.trim()) {
      throw new AutenticacionRequeridaError(
        'Se requiere un token de autenticación válido para consultar la atención clínica.'
      );
    }

    // Resolver actor autenticado
    await this.odontologoContextPort.obtenerOdontologoActual(query.tokenAutenticacion);

    const consultaId = ConsultaId.reconstituir(query.consultaId);
    const consulta = await this.consultaRepository.buscarPorId(consultaId);

    if (!consulta) {
      throw new ConsultaNoEncontradaError(query.consultaId);
    }

    return ConsultaOdontologicaMapper.toResponseDto(consulta);
  }
}
