import { Injectable, ServiceUnavailableException } from '@nestjs/common';
import { InjectConnection } from '@nestjs/mongoose';
import type { Connection } from 'mongoose';

@Injectable()
export class AppService {
  constructor(@InjectConnection() private readonly connection: Connection) {}

  getHealth() {
    const isConnected = this.connection?.readyState === 1;

    return {
      service: 'ms2-expediente',
      status: 'ok',
      database: isConnected ? 'connected' : 'disconnected',
      timestamp: new Date().toISOString(),
    };
  }

  getReadiness() {
    if (this.connection?.readyState !== 1) {
      throw new ServiceUnavailableException('MongoDB is not connected');
    }
    return { status: 'ok' };
  }

  getHello(): string {
    return 'Hello World!';
  }
}
