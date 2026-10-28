import { Injectable, Optional } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import type { IMs1CredentialsProvider } from './ms1-credentials-provider.port.js';

/**
 * Proveedor de credenciales desacoplado que lee el token Bearer
 * desde variables de entorno (MS1_BEARER_TOKEN) o ConfigService.
 * Si no hay token configurado, retorna null de forma segura sin incrustar contraseñas.
 */
@Injectable()
export class EnvMs1CredentialsProvider implements IMs1CredentialsProvider {
  constructor(
    @Optional()
    private readonly configService?: ConfigService,
  ) {}

  async getBearerToken(): Promise<string | null> {
    const rawToken =
      this.configService?.get<string>('MS1_BEARER_TOKEN') ??
      process.env.MS1_BEARER_TOKEN ??
      null;

    const trimmed = rawToken?.trim();
    return trimmed ? trimmed : null;
  }
}

