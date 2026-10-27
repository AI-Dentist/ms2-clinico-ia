import { Inject, Injectable } from '@nestjs/common';
import {
  CONSULTA_ODONTOLOGICA_REPOSITORY,
  type IConsultaOdontologicaRepositoryPort,
} from '../../../consultas-odontologicas/domain/ports/consulta-odontologica.repository.port.js';
import { ConsultaId } from '../../../consultas-odontologicas/domain/value-objects/consulta-id.vo.js';
import type {
  IConsultaContextPort,
  ResumenConsultaParaEstudio,
} from '../../domain/ports/consulta-context.port.js';

@Injectable()
export class LocalConsultaContextAdapter implements IConsultaContextPort {
  constructor(
    @Inject(CONSULTA_ODONTOLOGICA_REPOSITORY)
    private readonly consultaRepo: IConsultaOdontologicaRepositoryPort
  ) {}

  async obtenerResumenConsulta(consultaId: string): Promise<ResumenConsultaParaEstudio | null> {
    try {
      const idVo = ConsultaId.reconstituir(consultaId);
      const c = await this.consultaRepo.buscarPorId(idVo);
      if (!c) {
        return null;
      }

      return {
        existe: true,
        historiaClinicaId: c.historiaClinicaId.valor,
        pacienteId: c.pacienteId.valor,
        estado: c.estado,
        odontologoId: c.odontologoId.valor,
      };
    } catch {
      return null;
    }
  }
}
