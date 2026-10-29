import { describe, it, expect } from 'vitest';
import { OutboxEvent } from './outbox-event.entity.js';

describe('OutboxEvent Entity', () => {
  const CONSULTA_ID = '550e8400-e29b-41d4-a716-446655440000';
  const PAYLOAD = {
    consultaId: CONSULTA_ID,
    pacienteId: '60000000-0000-0000-0000-000000000001',
    serviciosRealizados: [
      {
        servicioId: '80000000-0000-0000-0000-000000000003',
        cantidad: 1,
        precioUnitarioBs: 150.0,
      },
    ],
  };

  it('1. Debe inicializar correctamente un evento para consulta en estado PENDIENTE', () => {
    const ahora = new Date('2026-10-28T20:00:00.000Z');
    const evento = OutboxEvent.crearParaConsulta({
      aggregateId: CONSULTA_ID,
      payload: PAYLOAD,
      ahora,
    });

    expect(evento.id).toBeDefined();
    expect(evento.eventId).toBeDefined();
    expect(evento.aggregateId).toBe(CONSULTA_ID);
    expect(evento.aggregateType).toBe('ConsultaOdontologica');
    expect(evento.eventType).toBe('clinica.consulta.finalizada');
    expect(evento.exchange).toBe('dental.topic.exchange');
    expect(evento.routingKey).toBe('clinica.consulta.finalizada');
    expect(evento.status).toBe('PENDIENTE');
    expect(evento.attempts).toBe(0);
    expect(evento.maxAttempts).toBe(5);
    expect(evento.lockedUntil).toBeNull();
    expect(evento.workerId).toBeNull();
    expect(evento.publishedAt).toBeNull();
    expect(evento.payload).toEqual(expect.objectContaining(PAYLOAD));
    expect(evento.payload.eventId).toBe(evento.eventId);
  });

  it('2. Debe reclamar el evento asignando el workerId y la duración del lease', () => {
    const ahora = new Date('2026-10-28T20:00:00.000Z');
    const evento = OutboxEvent.crearParaConsulta({
      aggregateId: CONSULTA_ID,
      payload: PAYLOAD,
      ahora,
    });

    evento.reclamar('worker-1', 30_000, ahora);

    expect(evento.status).toBe('EN_PROCESO');
    expect(evento.workerId).toBe('worker-1');
    expect(evento.lockedUntil?.toISOString()).toBe(
      new Date('2026-10-28T20:00:30.000Z').toISOString(),
    );
  });

  it('3. Debe rechazar reclamo si otro trabajador tiene un lease activo', () => {
    const t0 = new Date('2026-10-28T20:00:00.000Z');
    const evento = OutboxEvent.crearParaConsulta({
      aggregateId: CONSULTA_ID,
      payload: PAYLOAD,
      ahora: t0,
    });

    evento.reclamar('worker-1', 30_000, t0);

    // worker-2 intenta reclamar a los 10 segundos (lease sigue vigente)
    const t10 = new Date('2026-10-28T20:00:10.000Z');
    expect(() => evento.reclamar('worker-2', 30_000, t10)).toThrow(
      /está bloqueado por el trabajador 'worker-1'/,
    );
  });

  it('4. Debe permitir reclamar si el lease previo ha expirado (recuperación de trabajador caído)', () => {
    const t0 = new Date('2026-10-28T20:00:00.000Z');
    const evento = OutboxEvent.crearParaConsulta({
      aggregateId: CONSULTA_ID,
      payload: PAYLOAD,
      ahora: t0,
    });

    evento.reclamar('worker-1', 30_000, t0);

    // worker-2 reclama a los 35 segundos (lease venció a los 30s)
    const t35 = new Date('2026-10-28T20:00:35.000Z');
    evento.reclamar('worker-2', 30_000, t35);

    expect(evento.workerId).toBe('worker-2');
    expect(evento.lockedUntil?.toISOString()).toBe(
      new Date('2026-10-28T20:01:05.000Z').toISOString(),
    );
  });

  it('5. Debe marcar como PUBLICADO y liberar el lock tras recibir ACK', () => {
    const t0 = new Date('2026-10-28T20:00:00.000Z');
    const evento = OutboxEvent.crearParaConsulta({
      aggregateId: CONSULTA_ID,
      payload: PAYLOAD,
      ahora: t0,
    });

    evento.reclamar('worker-1', 30_000, t0);
    const tAck = new Date('2026-10-28T20:00:02.000Z');
    evento.marcarPublicado('worker-1', tAck);

    expect(evento.status).toBe('PUBLICADO');
    expect(evento.publishedAt?.toISOString()).toBe(tAck.toISOString());
    expect(evento.lockedUntil).toBeNull();
  });

  it('6. Debe rechazar marcar como PUBLICADO si el workerId no coincide (fencing/lease protection)', () => {
    const t0 = new Date('2026-10-28T20:00:00.000Z');
    const evento = OutboxEvent.crearParaConsulta({
      aggregateId: CONSULTA_ID,
      payload: PAYLOAD,
      ahora: t0,
    });

    evento.reclamar('worker-1', 30_000, t0);

    expect(() =>
      evento.marcarPublicado('worker-tardio', new Date()),
    ).toThrow(/Violación de lease/);
  });

  it('7. Debe registrar fallo, incrementar intentos y programar reintento con backoff exponencial', () => {
    const t0 = new Date('2026-10-28T20:00:00.000Z');
    const evento = OutboxEvent.crearParaConsulta({
      aggregateId: CONSULTA_ID,
      payload: PAYLOAD,
      ahora: t0,
      maxAttempts: 3,
    });

    evento.reclamar('worker-1', 30_000, t0);
    evento.registrarFallo('worker-1', 'Timeout conectando a RabbitMQ', t0);

    expect(evento.status).toBe('PENDIENTE');
    expect(evento.attempts).toBe(1);
    expect(evento.workerId).toBeNull();
    expect(evento.lockedUntil).toBeNull();
    expect(evento.lastError).toBe('Timeout conectando a RabbitMQ');
    // 2^1 * 1000 = 2000ms (+ jitter)
    expect(evento.nextRetryAt.getTime()).toBeGreaterThanOrEqual(t0.getTime() + 2000);
  });

  it('8. Debe transicionar a ERROR_FATAL y preservar el evento al alcanzar maxAttempts', () => {
    const t0 = new Date('2026-10-28T20:00:00.000Z');
    const evento = OutboxEvent.crearParaConsulta({
      aggregateId: CONSULTA_ID,
      payload: PAYLOAD,
      ahora: t0,
      maxAttempts: 2,
    });

    evento.reclamar('worker-1', 30_000, t0);
    evento.registrarFallo('worker-1', 'Error 1', t0);

    evento.reclamar('worker-1', 30_000, t0);
    evento.registrarFallo('worker-1', 'Error 2 (crítico)', t0);

    expect(evento.status).toBe('ERROR_FATAL');
    expect(evento.attempts).toBe(2);
    expect(evento.lastError).toBe('Error 2 (crítico)');
  });

  it('9. Debe permitir recuperación supervisada reiniciando el evento a PENDIENTE', () => {
    const t0 = new Date('2026-10-28T20:00:00.000Z');
    const evento = OutboxEvent.crearParaConsulta({
      aggregateId: CONSULTA_ID,
      payload: PAYLOAD,
      ahora: t0,
      maxAttempts: 1,
    });

    evento.reclamar('worker-1', 30_000, t0);
    evento.registrarFallo('worker-1', 'Broker down', t0);
    expect(evento.status).toBe('ERROR_FATAL');

    evento.recuperacionSupervisada('RabbitMQ restaurado por SysAdmin', t0);

    expect(evento.status).toBe('PENDIENTE');
    expect(evento.attempts).toBe(0);
    expect(evento.workerId).toBeNull();
    expect(evento.lastError).toContain('Recuperación supervisada');
  });
});

