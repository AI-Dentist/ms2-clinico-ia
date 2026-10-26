import { Inject, Injectable } from '@nestjs/common';
import {
  HISTORIA_CLINICA_REPOSITORY,
  type IHistoriaClinicaRepository,
} from '../../../historias-clinicas/domain/ports/historia-clinica.repository.port.js';
import { HistoriaClinicaId } from '../../../historias-clinicas/domain/value-objects/historia-clinica-id.vo.js';
import type {
  IHistoriaClinicaContextPort,
  ResumenHistoriaClinicaParaOdontograma,
} from '../../application/ports/historia-clinica-context.port.js';

/**
 * Adaptador local en memoria que consulta el repositorio de Historia Clínica existente
 * para satisfacer los requisitos contextuales del módulo Odontograma sin acoplamiento directo.
 */
@Injectable()
export class LocalHistoriaClinicaContextAdapter implements IHistoriaClinicaContextPort {
  constructor(
    @Inject(HISTORIA_CLINICA_REPOSITORY)
    private readonly historiaClinicaRepository: IHistoriaClinicaRepository
  ) {}

  async obtenerResumenHistoria(
    historiaClinicaId: string
  ): Promise<ResumenHistoriaClinicaParaOdontograma | null> {
    try {
      const idVo = HistoriaClinicaId.reconstituir(historiaClinicaId);
      const historia = await this.historiaClinicaRepository.buscarPorId(idVo);

      if (!historia) {
        return null;
      }

      return {
        existe: true,
        pacienteId: historia.pacienteId.valor,
        estado: historia.estado,
      };
    } catch {
      return null;
    }
  }
}
