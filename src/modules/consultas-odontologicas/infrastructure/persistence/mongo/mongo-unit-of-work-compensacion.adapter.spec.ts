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

  it('no debe reintentar sin sesion si la transaccion ya inicio y falla a mitad de ejecucion', async () => {
    const errorTransaccion = new Error('ReplicaSet transaction aborted');
    const withTransactionMock = vi.fn().mockRejectedValue(errorTransaccion);
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

    let invocaciones = 0;
    await expect(
      adapter.ejecutarCompensacion(async (_session) => {
        invocaciones++;
      }),
    ).rejects.toThrow('ReplicaSet transaction aborted');

    // Debe haberse intentado una sola vez dentro de la sesión y no haber hecho fallback sin sesión
    expect(invocaciones).toBe(0); // withTransaction rechazó directamente
    expect(endSessionMock).toHaveBeenCalled();
  });
});
