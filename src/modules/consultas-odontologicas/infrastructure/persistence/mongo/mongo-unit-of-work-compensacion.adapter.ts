import { Injectable, Logger } from '@nestjs/common';
import { InjectConnection } from '@nestjs/mongoose';
import type { Connection, ClientSession } from 'mongoose';
import type { IUnitOfWorkCompensacionPort } from '../../../application/ports/unit-of-work-compensacion.port.js';

@Injectable()
export class MongoUnitOfWorkCompensacionAdapter implements IUnitOfWorkCompensacionPort {
  private readonly logger = new Logger(MongoUnitOfWorkCompensacionAdapter.name);

  constructor(
    @InjectConnection()
    private readonly connection: Connection,
  ) {}

  async ejecutarCompensacion<T>(
    operacion: (session: ClientSession | undefined) => Promise<T>,
  ): Promise<T> {
    if (!this.soportaTransacciones()) {
      this.logger.debug(
        '[MongoUnitOfWorkCompensacionAdapter] MongoDB Standalone detectado: ejecutando compensación sin sesión de réplica.',
      );
      return await operacion(undefined);
    }

    let session: ClientSession;
    try {
      session = await this.connection.startSession();
    } catch (err: unknown) {
      if (this.esErrorTransaccionNoSoportada(err)) {
        this.logger.warn(
          '[MongoUnitOfWorkCompensacionAdapter] Fallo al iniciar sesión transaccional en standalone. Ejecutando sin sesión.',
        );
        return await operacion(undefined);
      }
      throw err;
    }

    try {
      let resultado: T;
      await session.withTransaction(async () => {
        resultado = await operacion(session);
      });
      return resultado!;
    } finally {
      await session.endSession();
    }
  }

  private soportaTransacciones(): boolean {
    const client = this.connection.getClient?.() as
      | { topology?: { description?: { type?: string; setName?: string } } }
      | undefined;
    const topology = client?.topology;
    if (!topology) {
      return true;
    }

    const description = topology.description;
    const type = description?.type;
    const setName = description?.setName;

    if (
      setName ||
      type === 'ReplicaSetWithPrimary' ||
      type === 'ReplicaSetNoPrimary' ||
      type === 'Sharded'
    ) {
      return true;
    }

    if (type === 'Single' && !setName) {
      return false;
    }

    return true;
  }

  private esErrorTransaccionNoSoportada(err: unknown): boolean {
    if (!err || typeof err !== 'object') return false;
    const errorObj = err as { code?: number; message?: string; name?: string };
    if (errorObj.code === 20) return true;
    const msg = errorObj.message || '';
    if (
      msg.includes('Transaction numbers are only allowed on a replica set member or mongos') ||
      msg.includes('transactions are not supported') ||
      msg.includes('ReplicaSet')
    ) {
      return true;
    }
    return false;
  }
}
