import { describe, it, expect, vi } from 'vitest';
import { OutboxController } from './outbox.controller.js';
import type { IOutboxRepositoryPort } from '../../domain/ports/outbox-repository.port.js';

describe('OutboxController', () => {
  it('GET /status debe retornar métricas de eventos pendientes, en proceso, publicados y fatales', async () => {
    const mockFecha = new Date('2026-11-05T09:00:00Z');
    const mockRepo = {
      obtenerEstado: vi.fn().mockResolvedValue({
        pendientes: 2,
        enProceso: 0,
        publicados: 45,
        fatales: 1,
        eventosFatales: [
          {
            id: 'evt-fatal-1',
            aggregateId: 'agg-1',
            attempts: 5,
            maxAttempts: 5,
            lastError: 'Broker rejected',
            actualizadoEn: mockFecha,
          },
        ],
      }),
    };

    const controller = new OutboxController(
      mockRepo as unknown as IOutboxRepositoryPort,
    );

    const resultado = await controller.obtenerEstado();

    expect(resultado).toEqual({
      pendientes: 2,
      enProceso: 0,
      publicados: 45,
      fatales: 1,
      eventosFatales: [
        {
          id: 'evt-fatal-1',
          aggregateId: 'agg-1',
          attempts: 5,
          maxAttempts: 5,
          lastError: 'Broker rejected',
          actualizadoEn: mockFecha,
        },
      ],
    });
    expect(mockRepo.obtenerEstado).toHaveBeenCalled();
  });
});
