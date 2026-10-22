import { Injectable, Logger } from '@nestjs/common';
import type {
  IOdontologoContextPort,
  OdontologoContexto,
} from '../../domain/ports/odontologo-context.port.js';
import { AutenticacionRequeridaError } from '../../application/errors/autenticacion-requerida.error.js';

/**
 * Adaptador de desarrollo y pruebas para IOdontologoContextPort.
 *
 * ADVERTENCIA DE SEGURIDAD:
 * - Habilitado ÚNICAMENTE en entornos que NO sean 'production' (development / test).
 * - En producción, este puerto debe ser provisto por un adaptador que valide tokens JWT reales contra Keycloak / MS1.
 * - Utiliza EXCLUSIVAMENTE una lista blanca de identidades sintéticas controladas localmente.
 * - NO acepta tokens arbitrarios, patrones dinámicos ni asigna identidades predeterminadas.
 */
@Injectable()
export class MockOdontologoContextAdapter implements IOdontologoContextPort {
  private readonly logger = new Logger(MockOdontologoContextAdapter.name);

  // Lista blanca de identidades sintéticas autorizadas para dev y e2e
  private readonly tokensPermitidos = new Map<string, string>([
    ['token_valido', 'od_dev_001'],
    ['token_valido_123', 'od_operador_001'],
    ['token_valido_editor', 'od_editor_005'],
    ['token_dev_henry', 'od_henry_principal'],
    ['token_e2e_principal', 'od_e2e_001'],
    ['token_e2e_secundario', 'od_e2e_002'],
  ]);

  async obtenerOdontologoActual(token: string): Promise<OdontologoContexto> {
    if (process.env.NODE_ENV === 'production') {
      throw new Error(
        'CRÍTICO: MockOdontologoContextAdapter no está permitido en entornos de producción.',
      );
    }

    const t = token?.trim();
    if (!t) {
      throw new AutenticacionRequeridaError('Token de autenticación no proporcionado.');
    }

    // Verificar contra la lista blanca estricta de identidades sintéticas
    const odontologoId = this.tokensPermitidos.get(t);
    if (!odontologoId) {
      this.logger.warn(`Intento de acceso denegado: token '${t}' no autorizado en la lista blanca sintética.`);
      throw new AutenticacionRequeridaError('Token de autenticación inválido o no reconocido.');
    }

    return { odontologoId };
  }
}
