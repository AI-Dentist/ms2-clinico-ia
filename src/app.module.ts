import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { AppController } from './app.controller.js';
import { AppService } from './app.service.js';
import { validateEnv } from './config/env.validation.js';
import { DatabaseModule } from './infrastructure/database/database.module.js';
import { HistoriasClinicasModule } from './modules/historias-clinicas/historias-clinicas.module.js';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      validate: validateEnv,
    }),
    DatabaseModule,
    HistoriasClinicasModule,
  ],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule {}
