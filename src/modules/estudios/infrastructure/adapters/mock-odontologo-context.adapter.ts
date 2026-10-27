import { Injectable, Logger, UnauthorizedException } from '@nestjs/common';
import type {
  IOdontologoContextPort,
  OdontologoContexto,
} from '../../domain/ports/odontologo-context.port.js';

@Injectable()
export class MockOdontologoContextAdapter implements IOdontologoContextPort {
  private readonly logger = new Logger(MockOdontologoContextAdapter.name);

  // Lista blanca de tokens sintéticos autorizados en development y test
  private readonly tokensPermitidos = new Map<string, string>([
    ['token_valido', 'od_dev_001'],
    ['token_valido_123', 'od_operador_001'],
    ['token_valido_editor', 'od_editor_005'],
    ['token_dev_henry', 'od_henry_principal'],
    ['token_e2e_principal', 'od_e2e_001'],
    ['token_e2e_secundario', 'od_e2e_002'],
  ]);

  async obtenerOdontologoActual(token: string): Promise<OdontologoContexto> {
    const t = token?.trim();
    if (!t) {
      throw new UnauthorizedException('Token de autenticación no proporcionado.');
    }

    const odontologoId = this.tokensPermitidos.get(t);
    if (!odontologoId) {
      this.logger.warn('Intento de acceso denegado en módulo estudios: token no autorizado.');
      throw new UnauthorizedException('Token de autenticación inválido o no reconocido.');
    }

    return { odontologoId };
  }
}
