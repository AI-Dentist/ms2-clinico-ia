import { Inject, Injectable } from '@nestjs/common';
import {
  HISTORIA_CLINICA_REPOSITORY,
  type IHistoriaClinicaRepository,
} from '../../../historias-clinicas/domain/ports/historia-clinica.repository.port.js';
import { HistoriaClinicaId } from '../../../historias-clinicas/domain/value-objects/historia-clinica-id.vo.js';
import type {
  IHistoriaClinicaContextPort,
  ResumenHistoriaClinicaParaApertura,
} from '../../domain/ports/historia-clinica-context.port.js';

/**
 * Adaptador local en memoria que consulta el repositorio de Historia Clínica ya existente
 * y provee únicamente los datos necesarios para la apertura de consultas odontológicas
 * sin incurrir en llamadas HTTP internas ni duplicaciones innecesarias.
 */
@Injectable()
export class LocalHistoriaClinicaContextAdapter implements IHistoriaClinicaContextPort {
  constructor(
    @Inject(HISTORIA_CLINICA_REPOSITORY)
    private readonly historiaClinicaRepository: IHistoriaClinicaRepository
  ) {}

  async obtenerResumenParaApertura(
    historiaClinicaId: string
  ): Promise<ResumenHistoriaClinicaParaApertura | null> {
    try {
      const idVo = HistoriaClinicaId.reconstituir(historiaClinicaId);
      const historia = await this.historiaClinicaRepository.buscarPorId(idVo);

      if (!historia) {
        return null;
      }

      // 1. Extraer alergias críticas y su severidad
      const alergiasCriticas = historia.alergias.map((a) => ({
        sustancia: a.sustancia,
        severidad: a.severidad,
      }));

      // 2. Extraer condiciones médicas desde antecedentes confirmados
      const condicionesMedicas: string[] = [];
      const ant = historia.antecedentes;

      for (const enf of ant.enfermedadesCronicas) {
        if (enf.esConfirmado()) {
          condicionesMedicas.push(enf.nombre ? `${enf.nombre}: ${enf.detalle}` : `${enf.detalle}`);
        }
      }

      for (const med of ant.antecedentesMedicos) {
        if (med.esConfirmado()) {
          condicionesMedicas.push(med.nombre ? `${med.nombre}: ${med.detalle}` : `${med.detalle}`);
        }
      }

      const od = ant.antecedentesOdontologicos;
      if (od.sangradoGingival?.esConfirmado()) {
        condicionesMedicas.push(`Sangrado gingival: ${od.sangradoGingival.detalle}`);
      }
      if (od.bruxismo?.esConfirmado()) {
        condicionesMedicas.push(`Bruxismo: ${od.bruxismo.detalle}`);
      }

      // 3. Extraer medicación habitual
      const medicacionHabitual = historia.medicamentosActuales.map((m) => {
        const principio = m.principioActivo ? ` (${m.principioActivo})` : '';
        return `${m.nombre}${principio} - Dosis: ${m.dosis}`;
      });

      return {
        existe: true,
        pacienteId: historia.pacienteId.valor,
        estado: historia.estado,
        versionActual: historia.version,
        alergiasCriticas,
        condicionesMedicas,
        medicacionHabitual,
      };
    } catch {
      return null;
    }
  }
}
