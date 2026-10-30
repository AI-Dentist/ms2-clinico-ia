import { Global, Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { Reflector } from '@nestjs/core';
import { KeycloakJwtOdontologoContextAdapter } from './keycloak-jwt-odontologo-context.adapter.js';
import { RolesGuard } from './roles.guard.js';

@Global()
@Module({
  imports: [ConfigModule],
  providers: [
    KeycloakJwtOdontologoContextAdapter,
    RolesGuard,
    Reflector,
  ],
  exports: [
    KeycloakJwtOdontologoContextAdapter,
    RolesGuard,
  ],
})
export class AuthModule {}
