import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { AppController } from './app.controller.js';
import { AppService } from './app.service.js';
import { validateEnv } from './config/env.validation.js';
import { DatabaseModule } from './infrastructure/database/database.module.js';
import { HistoriasClinicasModule } from './modules/historias-clinicas/historias-clinicas.module.js';
import { ConsultasOdontologicasModule } from './modules/consultas-odontologicas/consultas-odontologicas.module.js';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      validate: validateEnv,
    }),
    DatabaseModule,
    HistoriasClinicasModule,
    ConsultasOdontologicasModule,
  ],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule {}
