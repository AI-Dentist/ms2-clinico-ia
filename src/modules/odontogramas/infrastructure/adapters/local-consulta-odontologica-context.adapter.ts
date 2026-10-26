import { Inject, Injectable } from '@nestjs/common';
import {
  CONSULTA_ODONTOLOGICA_REPOSITORY,
  type IConsultaOdontologicaRepositoryPort,
} from '../../../consultas-odontologicas/domain/ports/consulta-odontologica.repository.port.js';
import { ConsultaId } from '../../../consultas-odontologicas/domain/value-objects/consulta-id.vo.js';
import type {
  IConsultaOdontologicaContextPort,
  ResumenConsultaParaOdontograma,
} from '../../application/ports/consulta-odontologica-context.port.js';

/**
 * Adaptador local en memoria que consulta el repositorio de Consulta Odontológica existente
 * para validar pertenencia y estado operativo en el registro de revisiones del Odontograma.
 */
@Injectable()
export class LocalConsultaOdontologicaContextAdapter implements IConsultaOdontologicaContextPort {
  constructor(
    @Inject(CONSULTA_ODONTOLOGICA_REPOSITORY)
    private readonly consultaOdontologicaRepository: IConsultaOdontologicaRepositoryPort
  ) {}

  async obtenerResumenConsulta(
    consultaId: string
  ): Promise<ResumenConsultaParaOdontograma | null> {
    try {
      const idVo = ConsultaId.reconstituir(consultaId);
      const consulta = await this.consultaOdontologicaRepository.buscarPorId(idVo);

      if (!consulta) {
        return null;
      }

      return {
        existe: true,
        historiaClinicaId: consulta.historiaClinicaId.valor,
        pacienteId: consulta.pacienteId.valor,
        estado: consulta.estado,
      };
    } catch {
      return null;
    }
  }
}
