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
 * - NO acepta tokens arbitrarios ni asigna identidades predeterminadas si el token no es válido.
 */
@Injectable()
export class MockOdontologoContextAdapter implements IOdontologoContextPort {
  private readonly logger = new Logger(MockOdontologoContextAdapter.name);

  // Tokens de desarrollo/prueba reconocidos
  private readonly tokensPermitidos = new Map<string, string>([
    ['token_valido', 'od_dev_001'],
    ['token_valido_123', 'od_operador_001'],
    ['token_valido_editor', 'od_editor_005'],
    ['token_dev_henry', 'od_henry_principal'],
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

    // 1. Verificar si es un token fijo registrado para pruebas/desarrollo
    const odontologoIdRegistrado = this.tokensPermitidos.get(t);
    if (odontologoIdRegistrado) {
      return { odontologoId: odontologoIdRegistrado };
    }

    // 2. Patrón estructurado para pruebas dinámicas: 'dev-token-<odontologoId>' o 'test-token-<odontologoId>'
    const match = /^(?:dev|test)-token-([a-zA-Z0-9_-]+)$/.exec(t);
    if (match && match[1]) {
      return { odontologoId: match[1] };
    }

    // 3. Si el token no cumple ningún formato autorizado, RECHAZAR el acceso
    this.logger.warn(`Intento de acceso con token no reconocido en entorno dev/test: '${t}'`);
    throw new AutenticacionRequeridaError('Token de autenticación inválido o no reconocido.');
  }
}
