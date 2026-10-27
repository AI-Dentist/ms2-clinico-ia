import {
  Injectable,
  CanActivate,
  ExecutionContext,
  UnauthorizedException,
  Inject,
} from '@nestjs/common';
import type { Request } from 'express';
import {
  ODONTOLOGO_CONTEXT_PORT,
  type IOdontologoContextPort,
  type OdontologoContexto,
} from '../../../domain/ports/odontologo-context.port.js';

export interface RequestConOperador extends Request {
  operadorToken?: string;
  odontologoActual?: OdontologoContexto;
}

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
        'Header Authorization no proporcionado. Se requiere autenticación Bearer.'
      );
    }

    const partes = authHeader.split(' ');
    if (partes.length !== 2 || partes[0].toLowerCase() !== 'bearer') {
      throw new UnauthorizedException(
        'Formato de Authorization inválido. Debe seguir el esquema: Bearer <token>'
      );
    }

    const token = partes[1].trim();
    if (!token) {
      throw new UnauthorizedException('Token Bearer vacío.');
    }

    const odontologoContexto = await this.odontologoContextPort.obtenerOdontologoActual(token);

    request.operadorToken = token;
    request.odontologoActual = odontologoContexto;

    return true;
  }
}
