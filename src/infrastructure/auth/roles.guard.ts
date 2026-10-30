import {
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { ROLES_KEY } from './roles.decorator.js';

@Injectable()
export class RolesGuard implements CanActivate {
  constructor(private readonly reflector: Reflector) {}

  canActivate(context: ExecutionContext): boolean {
    const requiredRoles = this.reflector.getAllAndOverride<string[]>(ROLES_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);

    if (!requiredRoles || requiredRoles.length === 0) {
      return true;
    }

    const request = context.switchToHttp().getRequest();
    const odontologo = request.odontologoActual;

    if (!odontologo) {
      throw new UnauthorizedException(
        'Usuario no autenticado o contexto clínico ausente para evaluar roles.',
      );
    }

    const userRoles: string[] = (odontologo.roles || []).map((r: string) => r.toUpperCase());
    const normalizedRequired = requiredRoles.map((r: string) => r.toUpperCase());

    const hasRole =
      userRoles.includes('ADMIN') ||
      normalizedRequired.some((role) => userRoles.includes(role));

    if (!hasRole) {
      throw new ForbiddenException(
        `Acceso denegado: se requiere uno de los roles [${requiredRoles.join(', ')}]. Roles del usuario: [${userRoles.join(', ')}].`,
      );
    }

    return true;
  }
}
