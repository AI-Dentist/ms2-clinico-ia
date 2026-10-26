import { createParamDecorator, type ExecutionContext, UnauthorizedException } from '@nestjs/common';
import type { RequestConOperador } from '../guards/odontologo-auth.guard.js';

/**
 * Decorador de parámetro para inyectar el token del operador odontólogo
 * directamente en los métodos del controlador del Odontograma Clínico.
 *
 * Exige que la solicitud haya superado exitosamente el OdontologoAuthGuard.
 */
export const OperadorToken = createParamDecorator(
  (_data: unknown, ctx: ExecutionContext): string => {
    const request = ctx.switchToHttp().getRequest<RequestConOperador>();
    const token = request.operadorToken;

    if (!token) {
      throw new UnauthorizedException('No se encontró el token de autenticación del operador.');
    }

    return token;
  },
);
