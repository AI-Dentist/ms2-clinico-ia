import { createParamDecorator, type ExecutionContext } from '@nestjs/common';
import type { Request } from 'express';

interface RequestConToken extends Request {
  operadorToken?: string;
}

/**
 * Decorador de parámetro para inyectar el token del operador odontólogo
 * directamente en los controladores del Odontograma Clínico.
 *
 * Mecanismo de extracción:
 * 1. Reutiliza 'request.operadorToken' si un guard upstream lo proveyó.
 * 2. Si no, extrae el token directamente desde el encabezado estándar 'Authorization: Bearer <token>'.
 * 3. En la fase 7E-2 se formalizará el Guard HTTP estricto sobre este endpoint.
 */
export const OperadorToken = createParamDecorator(
  (_data: unknown, ctx: ExecutionContext): string | undefined => {
    const request = ctx.switchToHttp().getRequest<RequestConToken>();

    if (request.operadorToken) {
      return request.operadorToken;
    }

    const authHeader = request.headers?.authorization;
    if (typeof authHeader === 'string') {
      const parts = authHeader.trim().split(' ');
      if (parts.length === 2 && parts[0].toLowerCase() === 'bearer') {
        const token = parts[1].trim();
        return token.length > 0 ? token : undefined;
      }
    }

    return undefined;
  },
);
