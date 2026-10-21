import { Injectable } from '@nestjs/common';
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

  getHello(): string {
    return 'Hello World!';
  }
}
