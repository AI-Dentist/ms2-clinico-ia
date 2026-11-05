import { describe, it, expect, vi } from 'vitest';
import type { Connection, ClientSession } from 'mongoose';
import { MongoUnitOfWorkCompensacionAdapter } from './mongo-unit-of-work-compensacion.adapter.js';

describe('MongoUnitOfWorkCompensacionAdapter', () => {
  it('ejecuta la operacion dentro de una transaccion cuando el cluster soporta transacciones', async () => {
    const mockSession = {
      withTransaction: vi.fn(async (cb: (s: ClientSession) => Promise<any>) => {
        return await cb(mockSession as unknown as ClientSession);
      }),
      endSession: vi.fn().mockResolvedValue(undefined),
    } as unknown as ClientSession;

    const mockConnection = {
      getClient: vi.fn().mockReturnValue({
        topology: {
          description: {
            type: 'ReplicaSetWithPrimary',
            setName: 'rs0',
          },
        },
      }),
      startSession: vi.fn().mockResolvedValue(mockSession),
    } as unknown as Connection;

    const adapter = new MongoUnitOfWorkCompensacionAdapter(mockConnection);

    let ejecutado = false;
    await adapter.ejecutarCompensacion(async (session) => {
      expect(session).toBe(mockSession);
      ejecutado = true;
    });

    expect(ejecutado).toBe(true);
    expect(mockConnection.startSession).toHaveBeenCalled();
    expect(mockSession.withTransaction).toHaveBeenCalled();
    expect(mockSession.endSession).toHaveBeenCalled();
  });

  it('ejecuta la operacion sin transaccion en standalone cuando topology es Single sin replica set', async () => {
    const mockConnection = {
      getClient: vi.fn().mockReturnValue({
        topology: {
          description: {
            type: 'Single',
          },
        },
      }),
      startSession: vi.fn(),
    } as unknown as Connection;

    const adapter = new MongoUnitOfWorkCompensacionAdapter(mockConnection);

    let ejecutado = false;
    await adapter.ejecutarCompensacion(async (session) => {
      // En standalone pasa undefined como sesion
      expect(session).toBeUndefined();
      ejecutado = true;
    });

    expect(ejecutado).toBe(true);
    expect(mockConnection.startSession).not.toHaveBeenCalled();
  });
});
