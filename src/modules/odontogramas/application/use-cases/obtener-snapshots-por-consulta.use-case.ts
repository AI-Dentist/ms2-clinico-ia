import { Inject, Injectable } from '@nestjs/common';
import {
  type IOdontogramaRepositoryPort,
  ODONTOGRAMA_REPOSITORY,
} from '../../domain/ports/odontograma.repository.port.js';
import {
  type IConsultaOdontologicaContextPort,
  CONSULTA_ODONTOLOGICA_CONTEXT_PORT,
} from '../ports/consulta-odontologica-context.port.js';
import type { ObtenerSnapshotsPorConsultaQuery } from '../queries/obtener-snapshots-por-consulta.query.js';
import type { RevisionOdontogramaDto } from '../dtos/revision-odontograma.dto.js';
import { ConsultaId } from '../../../consultas-odontologicas/domain/value-objects/consulta-id.vo.js';
import { ConsultaInvalidaError } from '../errors/consulta-invalida.error.js';
import { OdontogramaMapper } from '../mappers/odontograma.mapper.js';

@Injectable()
export class ObtenerSnapshotsPorConsultaUseCase {
  constructor(
    @Inject(ODONTOGRAMA_REPOSITORY)
    private readonly odontogramaRepository: IOdontogramaRepositoryPort,
    @Inject(CONSULTA_ODONTOLOGICA_CONTEXT_PORT)
    private readonly consultaContext: IConsultaOdontologicaContextPort
  ) {}

  async ejecutar(query: ObtenerSnapshotsPorConsultaQuery): Promise<RevisionOdontogramaDto[]> {
    const consultaId = ConsultaId.reconstituir(query.consultaId);

    // 1. Validar existencia de la Consulta Odontológica
    const resumenConsulta = await this.consultaContext.obtenerResumenConsulta(consultaId.valor);
    if (!resumenConsulta || !resumenConsulta.existe) {
      throw ConsultaInvalidaError.noEncontrada(consultaId.valor);
    }

    // 2. Listar todas las revisiones asociadas a la consulta (múltiples revisiones admitidas)
    const revisiones = await this.odontogramaRepository.listarRevisionesPorConsultaId(consultaId);

    // 3. Mapear a DTOs ordenados
    return revisiones.map((r) => OdontogramaMapper.revisionToDto(r));
  }
}
