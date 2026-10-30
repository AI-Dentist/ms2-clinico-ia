import { NestFactory } from '@nestjs/core';
import { ConfigService } from '@nestjs/config';
import { ValidationPipe } from '@nestjs/common';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import { AppModule } from './app.module.js';
import { ProblemDetailsFilter } from './modules/historias-clinicas/infrastructure/http/filters/problem-details.filter.js';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);

  app.setGlobalPrefix('api/expediente');

  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
    }),
  );

  app.useGlobalFilters(new ProblemDetailsFilter());

  const swaggerConfig = new DocumentBuilder()
    .setTitle('MS2 - Expediente Clínico Odontológico')
    .setDescription('API REST del microservicio de expediente médico e historias clínicas')
    .setVersion('1.0')
    .addBearerAuth(
      {
        type: 'http',
        scheme: 'bearer',
        bearerFormat: 'JWT',
        description: 'Token de autenticación de operador/odontólogo',
      },
      'bearer',
    )
    .build();

  const document = SwaggerModule.createDocument(app, swaggerConfig);
  SwaggerModule.setup('api/expediente/docs', app, document);

  const configService = app.get(ConfigService);
  const corsOriginsRaw =
    configService.get<string>('CORS_ORIGINS') || configService.get<string>('CORS_ORIGIN');
  const configuredOrigins = corsOriginsRaw
    ? corsOriginsRaw.split(',').map((o) => o.trim()).filter(Boolean)
    : [];
  const defaultOrigins = [
    'http://localhost:4200',
    'http://localhost:4201',
    'http://localhost:8080',
    'http://localhost',
    'http://127.0.0.1:4200',
    'http://127.0.0.1:4201',
    'http://127.0.0.1:8080',
    'http://127.0.0.1',
  ];
  const allowedOrigins = Array.from(new Set([...defaultOrigins, ...configuredOrigins]));

  app.enableCors({
    origin: allowedOrigins,
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS', 'HEAD'],
    allowedHeaders: [
      'Content-Type',
      'Authorization',
      'Accept',
      'X-Requested-With',
      'Origin',
      'Idempotency-Key',
      'X-Correlation-ID',
      'X-Idempotency-Key',
    ],
  });

  const port = configService.get<number>('PORT', 3001);
  const host = configService.get<string>('HOST', '0.0.0.0');

  await app.listen(port, host);
}

void bootstrap();