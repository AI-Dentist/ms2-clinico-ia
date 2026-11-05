import { describe, it, expect, vi } from 'vitest';
import type { Connection, ClientSession } from 'mongoose';
import { MongoUnitOfWorkCompensacionAdapter } from './mongo-unit-of-work-compensacion.adapter.js';

describe('MongoUnitOfWorkCompensacionAdapter', () => {
  it('ejecuta la operacion dentro de una transaccion cuando el cluster soporta transacciones', async () => {
    const withTransactionMock = vi.fn(async (cb: (s: ClientSession) => Promise<any>) => {
      return await cb(mockSession as unknown as ClientSession);
    });
    const endSessionMock = vi.fn().mockResolvedValue(undefined);

    const mockSession = {
      withTransaction: withTransactionMock,
      endSession: endSessionMock,
    } as unknown as ClientSession;

    const startSessionMock = vi.fn().mockResolvedValue(mockSession);

    const mockConnection = {
      getClient: vi.fn().mockReturnValue({
        topology: {
          description: {
            type: 'ReplicaSetWithPrimary',
            setName: 'rs0',
          },
        },
      }),
      startSession: startSessionMock,
    } as unknown as Connection;

    const adapter = new MongoUnitOfWorkCompensacionAdapter(mockConnection);

    let ejecutado = false;
    await adapter.ejecutarCompensacion(async (session) => {
      expect(session).toBe(mockSession);
      ejecutado = true;
    });

    expect(ejecutado).toBe(true);
    expect(startSessionMock).toHaveBeenCalled();
    expect(withTransactionMock).toHaveBeenCalled();
    expect(endSessionMock).toHaveBeenCalled();
  });

  it('ejecuta la operacion sin transaccion en standalone cuando topology es Single sin replica set', async () => {
    const startSessionMock = vi.fn();
    const mockConnection = {
      getClient: vi.fn().mockReturnValue({
        topology: {
          description: {
            type: 'Single',
          },
        },
      }),
      startSession: startSessionMock,
    } as unknown as Connection;

    const adapter = new MongoUnitOfWorkCompensacionAdapter(mockConnection);

    let ejecutado = false;
    await adapter.ejecutarCompensacion(async (session) => {
      // En standalone pasa undefined como sesion
      expect(session).toBeUndefined();
      ejecutado = true;
    });

    expect(ejecutado).toBe(true);
    expect(startSessionMock).not.toHaveBeenCalled();
  });
});
