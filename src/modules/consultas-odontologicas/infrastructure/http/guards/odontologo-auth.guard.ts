import {
  Injectable,
  CanActivate,
  ExecutionContext,
  UnauthorizedException,
  ServiceUnavailableException,
  Inject,
} from '@nestjs/common';
import type { Request } from 'express';
import {
  ODONTOLOGO_CONTEXT_PORT,
  type IOdontologoContextPort,
  type OdontologoContexto,
} from '../../../domain/ports/odontologo-context.port.js';
import { AutenticacionRequeridaError } from '../../../application/errors/autenticacion-requerida.error.js';
import { ServicioIdentidadNoDisponibleError } from '../../../../../infrastructure/auth/servicio-identidad-no-disponible.error.js';

export interface RequestConOperador extends Request {
  operadorToken?: string;
  odontologoActual?: OdontologoContexto;
}

/**
 * Guard de autenticación para los endpoints de Consultas Odontológicas.
 *
 * Exige la presencia obligatoria de un header estándar Authorization: Bearer <token>.
 * Extrae y valida el token contra el puerto IOdontologoContextPort (lista blanca sintética autorizada en dev/test),
 * inyectándolo en la request para su uso seguro por los casos de uso.
 */
@Injectable()
export class OdontologoAuthGuard implements CanActivate {
  constructor(
    @Inject(ODONTOLOGO_CONTEXT_PORT)
    private readonly odontologoContextPort: IOdontologoContextPort,
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
      const odontologo = await this.odontologoContextPort.obtenerOdontologoActual(token);
      request.operadorToken = token;
      request.odontologoActual = odontologo;
      return true;
    } catch (err) {
      if (err instanceof ServicioIdentidadNoDisponibleError) {
        throw new ServiceUnavailableException(err.message);
      }
      if (err instanceof ServiceUnavailableException) {
        throw err;
      }
      if (err instanceof AutenticacionRequeridaError) {
        throw new UnauthorizedException(err.message);
      }
      throw err;
    }
  }
}
