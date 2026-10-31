import { Global, Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { Reflector } from '@nestjs/core';
import { KeycloakJwtOdontologoContextAdapter } from './keycloak-jwt-odontologo-context.adapter.js';
import { GraphqlMs1CanonicalDoctorResolverAdapter } from './graphql-ms1-canonical-doctor-resolver.adapter.js';
import { CANONICAL_DOCTOR_RESOLVER } from './canonical-doctor-resolver.port.js';
import { RolesGuard } from './roles.guard.js';

@Global()
@Module({
  imports: [ConfigModule],
  providers: [
    GraphqlMs1CanonicalDoctorResolverAdapter,
    {
      provide: CANONICAL_DOCTOR_RESOLVER,
      useClass: GraphqlMs1CanonicalDoctorResolverAdapter,
    },
    KeycloakJwtOdontologoContextAdapter,
    RolesGuard,
    Reflector,
  ],
  exports: [
    CANONICAL_DOCTOR_RESOLVER,
    GraphqlMs1CanonicalDoctorResolverAdapter,
    KeycloakJwtOdontologoContextAdapter,
    RolesGuard,
  ],
})
export class AuthModule {}
