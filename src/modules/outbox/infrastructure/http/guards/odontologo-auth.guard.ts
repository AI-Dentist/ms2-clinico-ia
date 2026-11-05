import {
  Injectable,
  CanActivate,
  ExecutionContext,
  UnauthorizedException,
  ServiceUnavailableException,
} from '@nestjs/common';
import type { Request } from 'express';
import { KeycloakJwtOdontologoContextAdapter } from '../../../../../infrastructure/auth/keycloak-jwt-odontologo-context.adapter.js';
import { AutenticacionRequeridaError } from '../../../../../modules/historias-clinicas/application/errors/autenticacion-requerida.error.js';
import { ServicioIdentidadNoDisponibleError } from '../../../../../infrastructure/auth/servicio-identidad-no-disponible.error.js';

export interface RequestConOperador extends Request {
  operadorToken?: string;
  odontologoActual?: any;
}

/**
 * Guard de autenticación para los endpoints administrativos de Outbox.
 *
 * Exige cabecera Authorization: Bearer <token> y resuelve el contexto
 * del operador mediante KeycloakJwtOdontologoContextAdapter.
 */
@Injectable()
export class OdontologoAuthGuard implements CanActivate {
  constructor(
    private readonly authAdapter: KeycloakJwtOdontologoContextAdapter,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest<RequestConOperador>();
    const authHeader = request.headers.authorization;

    if (!authHeader) {
      throw new UnauthorizedException(
        'Header Authorization no proporcionado. Se requiere autenticación Bearer.',
      );
    }

    const parts = authHeader.trim().split(' ');
    if (parts.length !== 2 || parts[0].toLowerCase() !== 'bearer') {
      throw new UnauthorizedException(
        "Formato de autenticación inválido. Formato esperado: 'Bearer <token>'.",
      );
    }

    const token = parts[1].trim();
    if (!token) {
      throw new UnauthorizedException('Token de autenticación vacío.');
    }

    try {
      const odontologo = await this.authAdapter.obtenerOdontologoActual(token);
      request.operadorToken = token;
      request.odontologoActual = odontologo;
      return true;
    } catch (err: any) {
      if (err instanceof ServicioIdentidadNoDisponibleError) {
        throw new ServiceUnavailableException(err.message);
      }
      if (err instanceof ServiceUnavailableException) {
        throw err;
      }
      if (err instanceof AutenticacionRequeridaError) {
        throw new UnauthorizedException(err.message);
      }
      throw new UnauthorizedException(err.message || 'Error de autenticación.');
    }
  }
}
