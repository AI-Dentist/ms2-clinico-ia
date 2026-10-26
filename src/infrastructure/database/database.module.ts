import { Module, Logger, Global } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { ConfigModule, ConfigService } from '@nestjs/config';
import type { Connection } from 'mongoose';

@Global()
@Module({
  imports: [
    MongooseModule.forRootAsync({
      imports: [ConfigModule],
      inject: [ConfigService],
      useFactory: (configService: ConfigService) => {
        const uri = configService.getOrThrow<string>('MONGODB_URI');
        const logger = new Logger('MongoDB');

        return {
          uri,
          connectionFactory: (connection: Connection) => {
            if (connection.readyState === 1) {
              logger.log('Conexión con MongoDB establecida exitosamente.');
            }

            connection.on('connected', () => {
              logger.log('Conexión con MongoDB establecida exitosamente.');
            });

            connection.on('error', (error: Error) => {
              // Sanitizar cualquier credencial en caso de que aparezca en el mensaje
              const safeMsg = error.message.replace(
                /mongodb(\+srv)?:\/\/[^@]+@/,
                'mongodb$1://***:***@',
              );
              logger.error(`Error en la conexión a MongoDB: ${safeMsg}`);
            });

            connection.on('disconnected', () => {
              logger.warn('Desconectado de MongoDB.');
            });

            return connection;
          },
        };
      },
    }),
  ],
  exports: [MongooseModule],
})
export class DatabaseModule {}
