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
import { OdontologoId } from '../../domain/value-objects/odontologo-id.vo.js';
import { ConsultaNoEncontradaError } from '../../domain/errors/consulta-no-encontrada.error.js';
import { ConflictoConcurrenteConsultaError } from '../../domain/errors/conflicto-concurrente-consulta.error.js';
import { AutenticacionRequeridaError } from '../errors/autenticacion-requerida.error.js';
import { ConsultaOdontologicaMapper } from '../mappers/consulta-odontologica.mapper.js';
import type { CancelarConsultaCommand } from '../commands/cancelar-consulta.command.js';
import type { ConsultaOdontologicaResponseDto } from '../dtos/consulta-odontologica-response.dto.js';

@Injectable()
export class CancelarConsultaUseCase {
  constructor(
    @Inject(CONSULTA_ODONTOLOGICA_REPOSITORY)
    private readonly consultaRepository: IConsultaOdontologicaRepositoryPort,
    @Inject(ODONTOLOGO_CONTEXT_PORT)
    private readonly odontologoContextPort: IOdontologoContextPort
  ) {}

  async execute(
    command: CancelarConsultaCommand,
    ahora: Date = new Date()
  ): Promise<ConsultaOdontologicaResponseDto> {
    if (!command.tokenAutenticacion?.trim()) {
      throw new AutenticacionRequeridaError(
        'Se requiere un token de autenticación válido para cancelar la consulta.'
      );
    }

    // 1. Resolver actor autenticado
    const contexto = await this.odontologoContextPort.obtenerOdontologoActual(command.tokenAutenticacion);
    const odontologoId = OdontologoId.crear(contexto.odontologoId);

    // 2. Recuperar la consulta existente
    const consultaId = ConsultaId.reconstituir(command.consultaId);
    const consulta = await this.consultaRepository.buscarPorId(consultaId);
    if (!consulta) {
      throw new ConsultaNoEncontradaError(command.consultaId);
    }

    // 3. Verificación de concurrencia optimista en memoria (INV-CONS-09)
    if (consulta.version !== command.versionEsperada) {
      throw new ConflictoConcurrenteConsultaError(command.consultaId, command.versionEsperada);
    }

    // 4. Cancelar en el aggregate root (valida INV-CONS-04 e INV-CONS-06 con justificación >= 10 chars)
    consulta.cancelar(command.motivoCancelacion, odontologoId, ahora);

    // 5. Persistir con concurrencia optimista
    await this.consultaRepository.actualizar(consulta, command.versionEsperada);

    return ConsultaOdontologicaMapper.toResponseDto(consulta);
  }
}
