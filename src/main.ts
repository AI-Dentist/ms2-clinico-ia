import { NestFactory } from '@nestjs/core';
import { ConfigService } from '@nestjs/config';
import { AppModule } from './app.module.js';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);

  app.setGlobalPrefix('api/expediente');

  const configService = app.get(ConfigService);
  const port = configService.get<number>('PORT', 3001);

  await app.listen(port, '127.0.0.1');
}

void bootstrap();