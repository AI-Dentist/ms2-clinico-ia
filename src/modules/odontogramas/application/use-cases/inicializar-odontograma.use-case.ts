import { Inject, Injectable } from '@nestjs/common';
import {
  type IOdontogramaRepositoryPort,
  ODONTOGRAMA_REPOSITORY,
} from '../../domain/ports/odontograma.repository.port.js';
import {
  type IHistoriaClinicaContextPort,
  HISTORIA_CLINICA_CONTEXT_PORT,
} from '../ports/historia-clinica-context.port.js';
import {
  type IOdontologoContextPort,
  ODONTOLOGO_CONTEXT_PORT,
} from '../ports/odontologo-context.port.js';
import type { InicializarOdontogramaCommand } from '../commands/inicializar-odontograma.command.js';
import type { OdontogramaActualDto } from '../dtos/odontograma-actual.dto.js';
import { Odontograma } from '../../domain/entities/odontograma.entity.js';
import { HistoriaClinicaId } from '../../../historias-clinicas/domain/value-objects/historia-clinica-id.vo.js';
import { PacienteId } from '../../../historias-clinicas/domain/value-objects/paciente-id.vo.js';
import { OdontologoId } from '../../../historias-clinicas/domain/value-objects/odontologo-id.vo.js';
import { HistoriaClinicaInvalidaError } from '../errors/historia-clinica-invalida.error.js';
import { OdontogramaDuplicadoError } from '../../domain/errors/odontograma-duplicado.error.js';
import { OdontogramaMapper } from '../mappers/odontograma.mapper.js';

@Injectable()
export class InicializarOdontogramaUseCase {
  constructor(
    @Inject(ODONTOGRAMA_REPOSITORY)
    private readonly odontogramaRepository: IOdontogramaRepositoryPort,
    @Inject(HISTORIA_CLINICA_CONTEXT_PORT)
    private readonly historiaClinicaContext: IHistoriaClinicaContextPort,
    @Inject(ODONTOLOGO_CONTEXT_PORT)
    private readonly odontologoContext: IOdontologoContextPort
  ) {}

  async ejecutar(comando: InicializarOdontogramaCommand): Promise<OdontogramaActualDto> {
    const historiaId = HistoriaClinicaId.reconstituir(comando.historiaClinicaId);

    // 1. Validar existencia y estado activo de la Historia Clínica
    const resumenHc = await this.historiaClinicaContext.obtenerResumenHistoria(historiaId.valor);
    if (!resumenHc || !resumenHc.existe) {
      throw HistoriaClinicaInvalidaError.noEncontrada(historiaId.valor);
    }
    if (resumenHc.estado !== 'ACTIVA') {
      throw HistoriaClinicaInvalidaError.noActiva(historiaId.valor, resumenHc.estado);
    }

    // 2. Obtener pacienteId real garantizado por el expediente clínico
    const pacienteId = PacienteId.crear(resumenHc.pacienteId);

    // 3. Resolver identidad del odontólogo a partir del contexto autenticado
    const odontologoCtx = await this.odontologoContext.obtenerOdontologoActual(comando.tokenOdontologo);
    const odontologoId = OdontologoId.crear(odontologoCtx.odontologoId);

    // 4. Comprobar que no exista odontograma longitudinal previo para la historia clínica
    const existente = await this.odontogramaRepository.buscarPorHistoriaClinicaId(historiaId);
    if (existente) {
      throw new OdontogramaDuplicadoError(historiaId.valor);
    }

    // 5. Inicializar agregado y revisión basal (52 piezas FDI en estado DESCONOCIDO y NO_EVALUADO)
    const { odontograma, revisionBasal } = Odontograma.inicializar({
      historiaClinicaId: historiaId,
      pacienteId,
      odontologoId,
    });

    // 6. Persistir atómicamente odontograma y revisión basal
    await this.odontogramaRepository.guardarInicial(odontograma, revisionBasal);

    // 7. Retornar DTO inmutable
    return OdontogramaMapper.toActualDto(odontograma);
  }
}
