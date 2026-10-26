import { Inject, Injectable } from '@nestjs/common';
import {
  type IOdontogramaRepositoryPort,
  ODONTOGRAMA_REPOSITORY,
} from '../../domain/ports/odontograma.repository.port.js';
import {
  type IHistoriaClinicaContextPort,
  HISTORIA_CLINICA_CONTEXT_PORT,
} from '../ports/historia-clinica-context.port.js';
import type { ObtenerOdontogramaActualQuery } from '../queries/obtener-odontograma-actual.query.js';
import type { OdontogramaActualDto } from '../dtos/odontograma-actual.dto.js';
import { HistoriaClinicaId } from '../../../historias-clinicas/domain/value-objects/historia-clinica-id.vo.js';
import { OdontogramaNoEncontradoError } from '../../domain/errors/odontograma-no-encontrado.error.js';
import { HistoriaClinicaInvalidaError } from '../errors/historia-clinica-invalida.error.js';
import { OdontogramaMapper } from '../mappers/odontograma.mapper.js';

@Injectable()
export class ObtenerOdontogramaActualUseCase {
  constructor(
    @Inject(ODONTOGRAMA_REPOSITORY)
    private readonly odontogramaRepository: IOdontogramaRepositoryPort,
    @Inject(HISTORIA_CLINICA_CONTEXT_PORT)
    private readonly historiaClinicaContext: IHistoriaClinicaContextPort
  ) {}

  async ejecutar(query: ObtenerOdontogramaActualQuery): Promise<OdontogramaActualDto> {
    const historiaId = HistoriaClinicaId.reconstituir(query.historiaClinicaId);

    // 1. Validar acceso y existencia de la Historia Clínica en contexto clínico
    const resumenHc = await this.historiaClinicaContext.obtenerResumenHistoria(historiaId.valor);
    if (!resumenHc || !resumenHc.existe) {
      throw HistoriaClinicaInvalidaError.noEncontrada(historiaId.valor);
    }

    // 2. Consultar el odontograma longitudinal consolidado
    const odontograma = await this.odontogramaRepository.buscarPorHistoriaClinicaId(historiaId);
    if (!odontograma) {
      throw new OdontogramaNoEncontradoError(historiaId.valor);
    }

    // 3. Mapear a DTO con las 52 piezas y estados explícitos DESCONOCIDO / NO_EVALUADO
    return OdontogramaMapper.toActualDto(odontograma);
  }
}
