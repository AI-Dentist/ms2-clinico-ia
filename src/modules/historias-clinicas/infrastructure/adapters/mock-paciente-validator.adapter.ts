import { Injectable, Logger } from '@nestjs/common';
import type { IPacienteValidatorPort } from '../../domain/ports/paciente-validator.port.js';

/**
 * Adaptador de desarrollo y pruebas para IPacienteValidatorPort.
 *
 * ADVERTENCIA DE SEGURIDAD:
 * - Habilitado ÚNICAMENTE en entornos que NO sean 'production' (development / test).
 * - En producción, este puerto debe consultar el endpoint REST de MS1 (Spring Boot):
 *   GET /api/seguridad/pacientes/:id/existe.
 */
@Injectable()
export class MockPacienteValidatorAdapter implements IPacienteValidatorPort {
  private readonly logger = new Logger(MockPacienteValidatorAdapter.name);

  // Lista negra de identificadores simulados como no existentes en MS1
  private readonly pacientesInexistentes = new Set<string>([
    'pac_no_existe',
    'pac_inexistente',
    'pac_no_encontrado_ms1',
  ]);

  async existePaciente(pacienteId: string): Promise<boolean> {
    if (process.env.NODE_ENV === 'production') {
      throw new Error(
        'CRÍTICO: MockPacienteValidatorAdapter no está permitido en entornos de producción.',
      );
    }

    const pid = pacienteId?.trim();
    if (!pid) {
      return false;
    }

    if (this.pacientesInexistentes.has(pid) || pid.toLowerCase().includes('no_existe')) {
      this.logger.debug(`Paciente '${pid}' marcado como inexistente por el mock adapter.`);
      return false;
    }

    // Por defecto en desarrollo, se asume que pacientes con ID válidos existen en MS1
    return true;
  }
}
