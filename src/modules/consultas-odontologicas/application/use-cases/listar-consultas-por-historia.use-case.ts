import { Inject, Injectable } from '@nestjs/common';
import {
  CONSULTA_ODONTOLOGICA_REPOSITORY,
  type IConsultaOdontologicaRepositoryPort,
} from '../../domain/ports/consulta-odontologica.repository.port.js';
import {
  HISTORIA_CLINICA_CONTEXT_PORT,
  type IHistoriaClinicaContextPort,
} from '../../domain/ports/historia-clinica-context.port.js';
import {
  ODONTOLOGO_CONTEXT_PORT,
  type IOdontologoContextPort,
} from '../../domain/ports/odontologo-context.port.js';
import { HistoriaClinicaId } from '../../domain/value-objects/historia-clinica-id.vo.js';
import { HistoriaClinicaNoHabilitadaError } from '../../domain/errors/historia-clinica-no-habilitada.error.js';
import { AutenticacionRequeridaError } from '../errors/autenticacion-requerida.error.js';
import { ConsultaOdontologicaMapper } from '../mappers/consulta-odontologica.mapper.js';
import type { ListarConsultasPorHistoriaQuery } from '../queries/listar-consultas-por-historia.query.js';
import type { ListadoConsultasResponseDto } from '../dtos/listado-consultas-response.dto.js';

@Injectable()
export class ListarConsultasPorHistoriaUseCase {
  constructor(
    @Inject(CONSULTA_ODONTOLOGICA_REPOSITORY)
    private readonly consultaRepository: IConsultaOdontologicaRepositoryPort,
    @Inject(HISTORIA_CLINICA_CONTEXT_PORT)
    private readonly historiaClinicaContextPort: IHistoriaClinicaContextPort,
    @Inject(ODONTOLOGO_CONTEXT_PORT)
    private readonly odontologoContextPort: IOdontologoContextPort
  ) {}

  async execute(query: ListarConsultasPorHistoriaQuery): Promise<ListadoConsultasResponseDto> {
    if (!query.tokenAutenticacion?.trim()) {
      throw new AutenticacionRequeridaError(
        'Se requiere un token de autenticación válido para listar las atenciones del expediente.'
      );
    }

    // Resolver actor autenticado
    await this.odontologoContextPort.obtenerOdontologoActual(query.tokenAutenticacion);

    // Verificar existencia del expediente
    const resumen = await this.historiaClinicaContextPort.obtenerResumenParaApertura(
      query.historiaClinicaId
    );
    if (!resumen || !resumen.existe) {
      throw new HistoriaClinicaNoHabilitadaError(query.historiaClinicaId);
    }

    // Paginación estable normalizada
    const limite = Math.min(Math.max(query.limite ?? 20, 1), 100);
    const offset = Math.max(query.offset ?? 0, 0);

    const historiaId = HistoriaClinicaId.crear(query.historiaClinicaId);
    const resultado = await this.consultaRepository.listarPorHistoriaClinica(historiaId, limite, offset);

    return {
      consultas: resultado.consultas.map((c) => ConsultaOdontologicaMapper.toResponseDto(c)),
      total: resultado.total,
      limite,
      offset,
    };
  }
}
