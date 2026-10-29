import { describe, it, expect, beforeEach } from 'vitest';
import { MockRabbitMqPublisherAdapter } from './mock-rabbitmq-publisher.adapter.js';

describe('MockRabbitMqPublisherAdapter', () => {
  let adapter: MockRabbitMqPublisherAdapter;

  const validPayload = {
    consultaId: '70000000-0000-0000-0000-000000000001',
    pacienteId: '60000000-0000-0000-0000-000000000001',
    odontologoId: '80000000-0000-0000-0000-000000000001',
    serviciosRealizados: [
      {
        servicioId: '90000000-0000-0000-0000-000000000001',
        cantidad: 1,
        precioUnitarioBs: '150.00',
        piezaDental: '16',
      },
      {
        servicioId: '90000000-0000-0000-0000-000000000002',
        cantidad: 2,
        precioUnitarioBs: 80.5,
        piezaDental: null,
      },
    ],
    observacionesCobro: 'Atención completada',
  };

  beforeEach(() => {
    adapter = new MockRabbitMqPublisherAdapter();
  });

  it('debe publicar correctamente un mensaje que cumple el contrato plano de MS1', async () => {
    await adapter.publicar(
      'dental.topic.exchange',
      'clinica.consulta.finalizada',
      validPayload,
    );

    expect(adapter.publicaciones.length).toBe(1);
    const pub = adapter.obtenerUltimaPublicacion();
    expect(pub).not.toBeNull();
    expect(pub?.exchange).toBe('dental.topic.exchange');
    expect(pub?.routingKey).toBe('clinica.consulta.finalizada');
    expect(pub?.payload.consultaId).toBe('70000000-0000-0000-0000-000000000001');
  });

  it('debe rechazar mensajes con envoltorio anidado "payload"', async () => {
    const wrappedPayload = {
      payload: validPayload,
    };

    await expect(
      adapter.publicar('dental.topic.exchange', 'clinica.consulta.finalizada', wrappedPayload),
    ).rejects.toThrow('el mensaje NO debe contener el envoltorio anidado "payload"');
  });

  it('debe rechazar si consultaId conserva el prefijo cons_', async () => {
    const invalid = {
      ...validPayload,
      consultaId: 'cons_70000000-0000-0000-0000-000000000001',
    };

    await expect(
      adapter.publicar('dental.topic.exchange', 'clinica.consulta.finalizada', invalid),
    ).rejects.toThrow("no debe tener el prefijo 'cons_'");
  });

  it('debe rechazar si consultaId no es un UUID válido', async () => {
    const invalid = {
      ...validPayload,
      consultaId: 'invalid-uuid-123',
    };

    await expect(
      adapter.publicar('dental.topic.exchange', 'clinica.consulta.finalizada', invalid),
    ).rejects.toThrow('no cumple con el formato UUID RFC 4122');
  });

  it('debe rechazar si pacienteId no es un UUID válido', async () => {
    const invalid = {
      ...validPayload,
      pacienteId: 'paciente-invalido',
    };

    await expect(
      adapter.publicar('dental.topic.exchange', 'clinica.consulta.finalizada', invalid),
    ).rejects.toThrow('debe ser un UUID válido de MS1');
  });

  it('debe rechazar si serviciosRealizados está vacío', async () => {
    const invalid = {
      ...validPayload,
      serviciosRealizados: [],
    };

    await expect(
      adapter.publicar('dental.topic.exchange', 'clinica.consulta.finalizada', invalid),
    ).rejects.toThrow('requiere al menos un servicioRealizado');
  });

  it('debe rechazar si piezaDental es un número en lugar de string o null', async () => {
    const invalid = {
      ...validPayload,
      serviciosRealizados: [
        {
          servicioId: '90000000-0000-0000-0000-000000000001',
          cantidad: 1,
          precioUnitarioBs: '150.00',
          piezaDental: 16 as unknown as string, // tipo inválido según contrato MS1
        },
      ],
    };

    await expect(
      adapter.publicar('dental.topic.exchange', 'clinica.consulta.finalizada', invalid),
    ).rejects.toThrow('La piezaDental debe ser string o null');
  });

  it('debe simular timeout cuando timeoutSimulado está activo', async () => {
    adapter.simularTimeout(true);

    await expect(
      adapter.publicar('dental.topic.exchange', 'clinica.consulta.finalizada', validPayload),
    ).rejects.toThrow('Timeout esperando Publisher Confirm');
  });

  it('debe simular mensaje no enrutable (NO_ROUTE)', async () => {
    adapter.simularNoEnrutado('Exchange o binding no encontrado');

    await expect(
      adapter.publicar('dental.topic.exchange', 'clinica.consulta.finalizada', validPayload),
    ).rejects.toThrow('Mensaje devuelto como inenrutable: Exchange o binding no encontrado');
  });

  it('debe simular error genérico del broker', async () => {
    adapter.simularError('Conexión perdida con RabbitMQ');

    await expect(
      adapter.publicar('dental.topic.exchange', 'clinica.consulta.finalizada', validPayload),
    ).rejects.toThrow('Conexión perdida con RabbitMQ');
  });

  it('debe limpiar historial de publicaciones y estado de simulación', async () => {
    await adapter.publicar('exchange', 'rk', validPayload);
    expect(adapter.publicaciones.length).toBe(1);

    adapter.simularTimeout(true);
    adapter.limpiar();

    expect(adapter.publicaciones.length).toBe(0);
    expect(adapter.obtenerUltimaPublicacion()).toBeNull();
    // Ya no debe dar timeout porque se limpió
    await expect(
      adapter.publicar('exchange', 'rk', validPayload),
    ).resolves.toBeUndefined();
  });
});

