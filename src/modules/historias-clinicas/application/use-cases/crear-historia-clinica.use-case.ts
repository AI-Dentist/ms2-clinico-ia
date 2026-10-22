import { Inject, Injectable } from '@nestjs/common';
import {
  HISTORIA_CLINICA_REPOSITORY,
  type IHistoriaClinicaRepository,
} from '../../domain/ports/historia-clinica.repository.port.js';
import {
  PACIENTE_VALIDATOR_PORT,
  type IPacienteValidatorPort,
} from '../../domain/ports/paciente-validator.port.js';
import {
  ODONTOLOGO_CONTEXT_PORT,
  type IOdontologoContextPort,
} from '../../domain/ports/odontologo-context.port.js';
import { HistoriaClinica } from '../../domain/entities/historia-clinica.entity.js';
import { PacienteId } from '../../domain/value-objects/paciente-id.vo.js';
import { OdontologoId } from '../../domain/value-objects/odontologo-id.vo.js';
import { HistoriaClinicaDuplicadaError } from '../../domain/errors/historia-clinica-duplicada.error.js';
import { PacienteInexistenteError } from '../errors/paciente-inexistente.error.js';
import { AutenticacionRequeridaError } from '../errors/autenticacion-requerida.error.js';
import { HistoriaClinicaMapper } from '../mappers/historia-clinica.mapper.js';
import type { CrearHistoriaClinicaCommand } from '../commands/crear-historia-clinica.command.js';
import type { HistoriaClinicaResponseDto } from '../dtos/historia-clinica-response.dto.js';

@Injectable()
export class CrearHistoriaClinicaUseCase {
  constructor(
    @Inject(HISTORIA_CLINICA_REPOSITORY)
    private readonly historiaClinicaRepository: IHistoriaClinicaRepository,
    @Inject(PACIENTE_VALIDATOR_PORT)
    private readonly pacienteValidatorPort: IPacienteValidatorPort,
    @Inject(ODONTOLOGO_CONTEXT_PORT)
    private readonly odontologoContextPort: IOdontologoContextPort,
  ) {}

  async execute(command: CrearHistoriaClinicaCommand): Promise<HistoriaClinicaResponseDto> {
    if (!command.tokenAutenticacion?.trim()) {
      throw new AutenticacionRequeridaError(
        'Se requiere un token de autenticación para registrar la apertura del expediente.',
      );
    }

    // 1. Resolver identidad autenticada del operador (no confiamos en IDs arbitrarios del cliente)
    const contextoOperador = await this.odontologoContextPort.obtenerOdontologoActual(
      command.tokenAutenticacion,
    );
    const operadorId = OdontologoId.crear(contextoOperador.odontologoId);

    // 2. Validar identificador y existencia del paciente en MS1
    const pacienteId = PacienteId.crear(command.pacienteId);
    const pacienteExiste = await this.pacienteValidatorPort.existePaciente(pacienteId.valor);
    if (!pacienteExiste) {
      throw new PacienteInexistenteError(pacienteId.valor);
    }

    // 3. Validar invariante INV-01: un solo expediente clínico por paciente
    const historiaExistente = await this.historiaClinicaRepository.existePorPacienteId(pacienteId);
    if (historiaExistente) {
      throw new HistoriaClinicaDuplicadaError(pacienteId.valor);
    }

    // 4. Mapear antecedentes si fueron provistos
    const antecedentes = command.antecedentes
      ? HistoriaClinicaMapper.toAntecedentesEntity(command.antecedentes)
      : undefined;

    // 5. Resolver odontólogo responsable (si se omite, el dominio usará al operador como fallback)
    const odontologoResponsableId = command.odontologoResponsableId
      ? OdontologoId.crear(command.odontologoResponsableId)
      : undefined;

    // 6. Crear el agregado de dominio (genera ID hc_, versión 1, auditoría CREACION)
    const historia = HistoriaClinica.crear(
      {
        pacienteId,
        odontologoResponsableId,
        antecedentes,
        observacionesGenerales: command.observacionesGenerales,
      },
      operadorId,
    );

    // 7. Persistir en el repositorio
    await this.historiaClinicaRepository.guardar(historia);

    return HistoriaClinicaMapper.toResponseDto(historia);
  }
}
