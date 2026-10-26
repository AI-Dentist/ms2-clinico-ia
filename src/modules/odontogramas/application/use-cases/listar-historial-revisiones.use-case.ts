import { Inject, Injectable } from '@nestjs/common';
import {
  type IOdontogramaRepositoryPort,
  ODONTOGRAMA_REPOSITORY,
} from '../../domain/ports/odontograma.repository.port.js';
import type { ListarHistorialRevisionesQuery } from '../queries/listar-historial-revisiones.query.js';
import type { ListadoRevisionesPaginadoDto } from '../dtos/listado-revisiones.dto.js';
import { OdontogramaId } from '../../domain/value-objects/odontograma-id.vo.js';
import { OdontogramaNoEncontradoError } from '../../domain/errors/odontograma-no-encontrado.error.js';
import { OdontogramaMapper } from '../mappers/odontograma.mapper.js';

@Injectable()
export class ListarHistorialRevisionesUseCase {
  constructor(
    @Inject(ODONTOGRAMA_REPOSITORY)
    private readonly odontogramaRepository: IOdontogramaRepositoryPort
  ) {}

  async ejecutar(query: ListarHistorialRevisionesQuery): Promise<ListadoRevisionesPaginadoDto> {
    const odontogramaId = OdontogramaId.reconstituir(query.odontogramaId);

    // 1. Validar existencia del odontograma
    const odontograma = await this.odontogramaRepository.buscarPorId(odontogramaId);
    if (!odontograma) {
      throw new OdontogramaNoEncontradoError(odontogramaId.valor);
    }

    // 2. Normalizar límites y paginación
    const limite = Math.min(Math.max(query.limite ?? 20, 1), 100);
    const offset = Math.max(query.offset ?? 0, 0);

    // 3. Consultar revisiones históricas paginadas
    const resultado = await this.odontogramaRepository.listarRevisiones(odontogramaId, limite, offset);

    // 4. Mapear entidades inmutables a DTOs
    return {
      total: resultado.total,
      limite,
      offset,
      revisiones: resultado.revisiones.map((r) => OdontogramaMapper.revisionToDto(r)),
    };
  }
}
