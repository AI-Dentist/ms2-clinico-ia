import { Injectable, Inject, Logger } from '@nestjs/common';
import { InjectConnection } from '@nestjs/mongoose';
import type { Connection, ClientSession } from 'mongoose';
import type { IUnitOfWorkCierreConsultaPort } from '../../../application/ports/unit-of-work-cierre-consulta.port.js';
import {
  CONSULTA_ODONTOLOGICA_REPOSITORY,
  type IConsultaOdontologicaRepositoryPort,
} from '../../../domain/ports/consulta-odontologica.repository.port.js';
import {
  OUTBOX_REPOSITORY_PORT,
  type IOutboxRepositoryPort,
} from '../../../../outbox/domain/ports/outbox-repository.port.js';
import type { ConsultaOdontologica } from '../../../domain/entities/consulta-odontologica.entity.js';
import type { OutboxEvent } from '../../../../outbox/domain/entities/outbox-event.entity.js';
import { TransaccionesNoSoportadasError } from '../../../domain/errors/transacciones-no-soportadas.error.js';

/**
 * Adaptador Mongoose del Unit of Work para coordinar el cierre transaccional de consultas
 * y el guardado del evento Outbox en una única ClientSession atómica.
 *
 * Rechaza de forma inmutable cualquier fallback secuencial si la base de datos es Standalone.
 */
@Injectable()
export class MongoUnitOfWorkCierreConsultaAdapter
  implements IUnitOfWorkCierreConsultaPort
{
  private readonly logger = new Logger(MongoUnitOfWorkCierreConsultaAdapter.name);

  constructor(
    @InjectConnection()
    private readonly connection: Connection,
    @Inject(CONSULTA_ODONTOLOGICA_REPOSITORY)
    private readonly consultaRepository: IConsultaOdontologicaRepositoryPort,
    @Inject(OUTBOX_REPOSITORY_PORT)
    private readonly outboxRepository: IOutboxRepositoryPort,
  ) {}

  async ejecutarCierreConOutbox(
    consulta: ConsultaOdontologica,
    versionEsperada: number,
    eventoOutbox: OutboxEvent,
  ): Promise<void> {
    // 1. Detección temprana de topología: si el cliente indica explícitamente topología 'Single' (Standalone),
    // rechazamos de inmediato antes de iniciar escrituras parciales.
    if (!this.soportaTransacciones()) {
      this.logger.warn(
        `[UnitOfWork] Rechazando cierre de consulta '${consulta.id.valor}' con servicios facturables: MongoDB Standalone no soporta transacciones multidocumento. No se realizaron escrituras.`,
      );
      throw new TransaccionesNoSoportadasError();
    }

    let session: ClientSession;
    try {
      session = await this.connection.startSession();
    } catch (err: unknown) {
      if (this.esErrorTransaccionNoSoportada(err)) {
        throw new TransaccionesNoSoportadasError();
      }
      throw err;
    }

    try {
      await session.withTransaction(async () => {
        // A. Actualizar la consulta odontológica con concurrencia optimista dentro de la sesión
        await this.consultaRepository.actualizar(
          consulta,
          versionEsperada,
          session,
        );

        // B. Persistir el evento Outbox dentro de la misma sesión atómica
        await this.outboxRepository.guardar(eventoOutbox, session);
      });
    } catch (err: unknown) {
      if (this.esErrorTransaccionNoSoportada(err)) {
        this.logger.warn(
          `[UnitOfWork] Fallo transaccional por falta de soporte en MongoDB (Standalone): ${err instanceof Error ? err.message : String(err)}`,
        );
        throw new TransaccionesNoSoportadasError();
      }
      // Re-lanzar error (ej: ConflictoConcurrenteConsultaError u otros) preservando la excepción de dominio
      throw err;
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

    // Si tiene setName o es ReplicaSet / Sharded, soporta transacciones
    if (
      setName ||
      type === 'ReplicaSetWithPrimary' ||
      type === 'ReplicaSetNoPrimary' ||
      type === 'Sharded'
    ) {
      return true;
    }

    // Standalone puro (Single sin replica set configurado)
    if (type === 'Single' && !setName) {
      return false;
    }

    return true;
  }

  private esErrorTransaccionNoSoportada(err: unknown): boolean {
    if (!err || typeof err !== 'object') return false;
    const errorObj = err as { code?: number; message?: string; name?: string };
    if (errorObj.code === 20) return true; // IllegalOperation en MongoDB
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
