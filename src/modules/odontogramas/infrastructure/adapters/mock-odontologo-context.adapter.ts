import { Injectable, Logger } from '@nestjs/common';
import type {
  IOdontologoContextPort,
  OdontologoContexto,
} from '../../application/ports/odontologo-context.port.js';
import { AutenticacionRequeridaError } from './errors/autenticacion-requerida.error.js';

/**
 * Adaptador sintético de desarrollo y pruebas para IOdontologoContextPort en el módulo Odontogramas.
 *
 * ADVERTENCIA DE SEGURIDAD Y LIMITACIONES:
 * - Habilitado ÚNICAMENTE en entornos que NO sean 'production' (development / test).
 * - En producción, este puerto debe ser satisfecho por un adaptador JWT que valide contra Keycloak / MS1.
 * - Utiliza EXCLUSIVAMENTE una lista blanca de identidades sintéticas autorizadas.
 * - NO acepta identidades arbitrarias ni asigna valores por defecto sin token válido.
 */
@Injectable()
export class MockOdontologoContextAdapter implements IOdontologoContextPort {
  private readonly logger = new Logger(MockOdontologoContextAdapter.name);

  // Lista blanca estricta de identidades sintéticas
  private readonly tokensPermitidos = new Map<string, string>([
    ['token_valido', 'od_dev_001'],
    ['token_valido_123', 'od_operador_001'],
    ['token_valido_editor', 'od_editor_005'],
    ['token_dev_henry', 'od_henry_principal'],
    ['token_e2e_principal', 'od_e2e_001'],
    ['token_e2e_secundario', 'od_e2e_002'],
  ]);

  private static readonly ENTORNOS_PERMITIDOS = ['development', 'test'];

  constructor() {
    this.validarEntornoSeguro();
  }

  private validarEntornoSeguro(): void {
    const env = process.env.NODE_ENV;
    if (!env || !MockOdontologoContextAdapter.ENTORNOS_PERMITIDOS.includes(env)) {
      throw new Error(
        `CRÍTICO: MockOdontologoContextAdapter deshabilitado por política de seguridad. Solo está permitido en entornos 'development' o 'test' (entorno actual: '${env || 'no configurado'}').`
      );
    }
  }

  async obtenerOdontologoActual(token?: string): Promise<OdontologoContexto> {
    this.validarEntornoSeguro();

    const t = token?.trim();
    if (!t) {
      throw new AutenticacionRequeridaError('Token de autenticación no proporcionado.');
    }

    const odontologoId = this.tokensPermitidos.get(t);
    if (!odontologoId) {
      this.logger.warn(
        'Intento de acceso denegado: token no autorizado en la lista blanca sintética.'
      );
      throw new AutenticacionRequeridaError('Token de autenticación inválido o no reconocido.');
    }

    return { odontologoId };
  }
}
