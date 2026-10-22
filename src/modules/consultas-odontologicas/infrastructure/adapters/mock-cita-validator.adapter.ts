import { Injectable, Logger } from '@nestjs/common';
import type {
  ICitaValidatorPort,
  ResultadoValidacionCita,
} from '../../domain/ports/cita-validator.port.js';

/**
 * Adaptador simulado para ICitaValidatorPort limitado exclusivamente a desarrollo y pruebas.
 *
 * ADVERTENCIA DE SEGURIDAD Y ARQUITECTURA:
 * - Habilitado ÚNICAMENTE en entornos de desarrollo y pruebas locales (NO apto para producción).
 * - En producción, este puerto debe comunicarse de forma segura con MS3 (Laravel / DynamoDB de Wendy).
 * - Utiliza EXCLUSIVAMENTE una lista blanca de identificadores de citas sintéticas reconocidas.
 * - NO acepta UUIDs arbitrarios ni genera citas automáticamente.
 */
@Injectable()
export class MockCitaValidatorAdapter implements ICitaValidatorPort {
  private readonly logger = new Logger(MockCitaValidatorAdapter.name);

  // Lista blanca de citas sintéticas reconocidas para desarrollo y tests
  private readonly citasReconocidas = new Set<string>([
    'cita_dev_001',
    'cita_dev_002',
    'cita_dev_003',
    'cita_e2e_urgencia',
    'cita_e2e_control',
    'cita_test_100',
  ]);

  async validarCitaParaAtencion(
    citaId: string,
    pacienteId: string
  ): Promise<ResultadoValidacionCita> {
    if (process.env.NODE_ENV === 'production') {
      throw new Error(
        'CRÍTICO: MockCitaValidatorAdapter no está permitido en entornos de producción.'
      );
    }

    const id = citaId?.trim();
    if (!id) {
      return {
        esValida: false,
        motivoInvalidez: 'El identificador de cita no puede estar vacío.',
      };
    }

    if (!this.citasReconocidas.has(id)) {
      this.logger.debug(
        `Cita '${id}' rechazada: no pertenece a la lista blanca sintética reconocida de MS3.`
      );
      return {
        esValida: false,
        motivoInvalidez: `La cita '${id}' no existe en la agenda de MS3 o no se encuentra confirmada.`,
      };
    }

    // Si el paciente es explícitamente inválido o ajeno en pruebas
    if (pacienteId === 'pac_impostor_999' || pacienteId === 'pac_ajeno_888') {
      return {
        esValida: false,
        motivoInvalidez: `La cita '${id}' pertenece a otro paciente en MS3.`,
      };
    }

    return { esValida: true };
  }
}
