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
} from '../../../application/ports/odontologo-context.port.js';
import { AutenticacionRequeridaError } from '../../adapters/errors/autenticacion-requerida.error.js';
import { ServicioIdentidadNoDisponibleError } from '../../../../../infrastructure/auth/servicio-identidad-no-disponible.error.js';

export interface RequestConOperador extends Request {
  operadorToken?: string;
  odontologoActual?: OdontologoContexto;
}

/**
 * Guard de autenticación para los endpoints del Odontograma Clínico.
 *
 * Exige la presencia obligatoria de la cabecera estándar Authorization: Bearer <token>.
 * Extrae y valida el token contra el puerto IOdontologoContextPort (lista blanca sintética
 * autorizada en entornos de dev/test), inyectándolo en la request para su consumo trazable
 * por los casos de uso.
 *
 * Rechaza de manera inmediata solicitudes sin token, con cabecera malformada o con identidades no autorizadas,
 * impidiendo la ejecución de cualquier caso de uso clínico.
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

    const trimmed = authHeader.trim();
    const parts = trimmed.split(/\s+/);

    if (parts[0].toLowerCase() !== 'bearer') {
      throw new UnauthorizedException(
        "Formato de autenticación inválido. Formato esperado: 'Bearer <token>'.",
      );
    }

    if (parts.length === 1) {
      throw new UnauthorizedException('Token de autenticación vacío.');
    }

    if (parts.length > 2) {
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
      if (err instanceof Error && err.message.includes('MockOdontologoContextAdapter deshabilitado')) {
        throw new UnauthorizedException('Mecanismo de autenticación no disponible en este entorno.');
      }
      throw err;
    }
  }
}
