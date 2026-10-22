import { Inject, Injectable } from '@nestjs/common';
import {
  HISTORIA_CLINICA_REPOSITORY,
  type IHistoriaClinicaRepository,
} from '../../domain/ports/historia-clinica.repository.port.js';
import {
  ODONTOLOGO_CONTEXT_PORT,
  type IOdontologoContextPort,
} from '../../domain/ports/odontologo-context.port.js';
import { HistoriaClinicaId } from '../../domain/value-objects/historia-clinica-id.vo.js';
import { OdontologoId } from '../../domain/value-objects/odontologo-id.vo.js';
import { HistoriaClinicaNoEncontradaError } from '../../domain/errors/historia-clinica-no-encontrada.error.js';
import { AutenticacionRequeridaError } from '../errors/autenticacion-requerida.error.js';
import { HistoriaClinicaMapper } from '../mappers/historia-clinica.mapper.js';
import type { ActualizarAntecedentesCommand } from '../commands/actualizar-antecedentes.command.js';
import type { HistoriaClinicaResponseDto } from '../dtos/historia-clinica-response.dto.js';

@Injectable()
export class ActualizarAntecedentesUseCase {
  constructor(
    @Inject(HISTORIA_CLINICA_REPOSITORY)
    private readonly historiaClinicaRepository: IHistoriaClinicaRepository,
    @Inject(ODONTOLOGO_CONTEXT_PORT)
    private readonly odontologoContextPort: IOdontologoContextPort,
  ) {}

  async execute(command: ActualizarAntecedentesCommand): Promise<HistoriaClinicaResponseDto> {
    if (!command.tokenAutenticacion?.trim()) {
      throw new AutenticacionRequeridaError(
        'Se requiere autenticación para actualizar los antecedentes de la historia clínica.',
      );
    }

    // 1. Obtener la identidad autenticada del operador
    const contextoOperador = await this.odontologoContextPort.obtenerOdontologoActual(
      command.tokenAutenticacion,
    );
    const operadorId = OdontologoId.crear(contextoOperador.odontologoId);

    // 2. Cargar el expediente actual
    const historiaId = HistoriaClinicaId.reconstituir(command.historiaClinicaId);
    const historia = await this.historiaClinicaRepository.buscarPorId(historiaId);

    if (!historia) {
      throw new HistoriaClinicaNoEncontradaError(command.historiaClinicaId);
    }

    // 3. Transformar antecedentes y aplicar comando de dominio (garantiza invariantes y auditoría)
    const nuevosAntecedentes = HistoriaClinicaMapper.toAntecedentesEntity(
      command.nuevosAntecedentes,
    );

    historia.actualizarAntecedentes(
      nuevosAntecedentes,
      operadorId,
      command.camposModificados,
      command.descripcion,
    );

    // 4. Persistir con control de concurrencia optimista (lanza ConflictoConcurrenteError si versionEsperada no coincide)
    const historiaActualizada = await this.historiaClinicaRepository.actualizar(
      historia,
      command.versionEsperada,
    );

    return HistoriaClinicaMapper.toResponseDto(historiaActualizada);
  }
}
