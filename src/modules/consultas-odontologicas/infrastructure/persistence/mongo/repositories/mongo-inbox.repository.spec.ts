import { describe, it, expect, vi } from 'vitest';
import type { Model } from 'mongoose';
import { MongoInboxRepository } from './mongo-inbox.repository.js';
import type { InboxEventDocument } from '../schemas/inbox-event.schema.js';

describe('MongoInboxRepository', () => {
  it('existe() debe retornar true si el evento ya existe en la colección inbox', async () => {
    const mockModel = {
      findOne: vi.fn().mockReturnValue({
        session: vi.fn().mockReturnValue({
          lean: vi.fn().mockResolvedValue({ eventId: 'evt-123' }),
        }),
      }),
    } as unknown as Model<InboxEventDocument>;

    const repo = new MongoInboxRepository(mockModel);
    const existe = await repo.existe('evt-123');

    expect(existe).toBe(true);
    expect(mockModel.findOne).toHaveBeenCalledWith({ eventId: 'evt-123' });
  });

  it('existe() debe retornar false si el evento no existe', async () => {
    const mockModel = {
      findOne: vi.fn().mockReturnValue({
        session: vi.fn().mockReturnValue({
          lean: vi.fn().mockResolvedValue(null),
        }),
      }),
    } as unknown as Model<InboxEventDocument>;

    const repo = new MongoInboxRepository(mockModel);
    const existe = await repo.existe('evt-nonexistent');

    expect(existe).toBe(false);
  });

  it('guardar() debe persistir el evento en la colección inbox pasando la sesión', async () => {
    const mockCreate = vi.fn().mockResolvedValue([]);
    const mockModel = {
      create: mockCreate,
    } as unknown as Model<InboxEventDocument>;

    const repo = new MongoInboxRepository(mockModel);
    const mockSession = {} as any;

    await repo.guardar(
      {
        eventId: 'evt-999',
        tipoEvento: 'facturacion.consulta.rechazada',
        procesadoEn: new Date('2026-11-05T09:00:00Z'),
      },
      mockSession,
    );

    expect(mockCreate).toHaveBeenCalledWith(
      [
        {
          eventId: 'evt-999',
          tipoEvento: 'facturacion.consulta.rechazada',
          procesadoEn: new Date('2026-11-05T09:00:00Z'),
        },
      ],
      { session: mockSession },
    );
  });
});
