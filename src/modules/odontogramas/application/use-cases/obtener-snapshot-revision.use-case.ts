import { Inject, Injectable } from '@nestjs/common';
import {
  type IOdontogramaRepositoryPort,
  ODONTOGRAMA_REPOSITORY,
} from '../../domain/ports/odontograma.repository.port.js';
import type { ObtenerSnapshotRevisionQuery } from '../queries/obtener-snapshot-revision.query.js';
import type { RevisionOdontogramaDto } from '../dtos/revision-odontograma.dto.js';
import { OdontogramaId } from '../../domain/value-objects/odontograma-id.vo.js';
import { RevisionId } from '../../domain/value-objects/revision-id.vo.js';
import { OdontogramaNoEncontradoError } from '../../domain/errors/odontograma-no-encontrado.error.js';
import { RevisionInvalidaError } from '../errors/revision-invalida.error.js';
import { OdontogramaMapper } from '../mappers/odontograma.mapper.js';

@Injectable()
export class ObtenerSnapshotRevisionUseCase {
  constructor(
    @Inject(ODONTOGRAMA_REPOSITORY)
    private readonly odontogramaRepository: IOdontogramaRepositoryPort
  ) {}

  async ejecutar(query: ObtenerSnapshotRevisionQuery): Promise<RevisionOdontogramaDto> {
    const odontogramaId = OdontogramaId.reconstituir(query.odontogramaId);
    const revisionId = RevisionId.reconstituir(query.revisionId);

    // 1. Validar existencia del odontograma
    const odontograma = await this.odontogramaRepository.buscarPorId(odontogramaId);
    if (!odontograma) {
      throw new OdontogramaNoEncontradoError(odontogramaId.valor);
    }

    // 2. Buscar la revisión histórica por ID
    const revision = await this.odontogramaRepository.buscarRevisionPorId(revisionId);
    if (!revision) {
      throw RevisionInvalidaError.noEncontrada(revisionId.valor);
    }

    // 3. Verificar pertenencia de la revisión al odontograma solicitado
    if (!revision.odontogramaId.equals(odontogramaId)) {
      throw RevisionInvalidaError.noPerteneceAlOdontograma(
        revisionId.valor,
        odontogramaId.valor,
        revision.odontogramaId.valor
      );
    }

    // 4. Retornar DTO de la revisión con su snapshot histórico sellado
    return OdontogramaMapper.revisionToDto(revision);
  }
}
