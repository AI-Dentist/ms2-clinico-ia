import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { Channel, ConsumeMessage } from 'amqplib';
import { FacturacionRechazadaConsumer } from './facturacion-rechazada.consumer.js';
import { RevertirCierrePorRechazoUseCase } from '../../application/use-cases/revertir-cierre-por-rechazo.use-case.js';
import type { IConsultaOdontologicaRepositoryPort } from '../../domain/ports/consulta-odontologica.repository.port.js';
import type { IInboxRepositoryPort } from '../../application/ports/inbox-repository.port.js';
import type { IUnitOfWorkCompensacionPort } from '../../application/ports/unit-of-work-compensacion.port.js';
import { ConsultaOdontologica } from '../../domain/entities/consulta-odontologica.entity.js';
import { HistoriaClinicaId } from '../../domain/value-objects/historia-clinica-id.vo.js';
import { PacienteId } from '../../domain/value-objects/paciente-id.vo.js';
import { OdontologoId } from '../../domain/value-objects/odontologo-id.vo.js';
import { MotivoConsulta } from '../../domain/value-objects/motivo-consulta.vo.js';
import { SnapshotRiesgoClinico } from '../../domain/value-objects/snapshot-riesgo-clinico.vo.js';
import { ExploracionFisica } from '../../domain/value-objects/exploracion-fisica.vo.js';
import { DiagnosticoItem } from '../../domain/value-objects/diagnostico-item.vo.js';
import { TipoDiagnostico } from '../../domain/value-objects/tipo-diagnostico.enum.js';
import { EstadoConsulta } from '../../domain/value-objects/estado-consulta.enum.js';
import { ServicioFacturableConsulta } from '../../domain/value-objects/servicio-facturable-consulta.vo.js';
import type { ConsultaId } from '../../domain/value-objects/consulta-id.vo.js';

describe('FacturacionRechazadaConsumer', () => {
  let mockUseCase: { execute: ReturnType<typeof vi.fn> };
  let mockChannel: {
    ack: ReturnType<typeof vi.fn>;
    nack: ReturnType<typeof vi.fn>;
    assertExchange: ReturnType<typeof vi.fn>;
    assertQueue: ReturnType<typeof vi.fn>;
    bindQueue: ReturnType<typeof vi.fn>;
    consume: ReturnType<typeof vi.fn>;
  };
  let consumer: FacturacionRechazadaConsumer;

  beforeEach(() => {
    mockUseCase = {
      execute: vi.fn().mockResolvedValue({ revertida: true }),
    };

    mockChannel = {
      ack: vi.fn(),
      nack: vi.fn(),
      assertExchange: vi.fn().mockResolvedValue({}),
      assertQueue: vi.fn().mockResolvedValue({}),
      bindQueue: vi.fn().mockResolvedValue({}),
      consume: vi.fn().mockResolvedValue({ consumerTag: 'tag-123' }),
    };

    consumer = new FacturacionRechazadaConsumer(
      mockUseCase as unknown as RevertirCierrePorRechazoUseCase,
      undefined,
      { enabled: false, initialBackoffMs: 0, maxBackoffMs: 0, sleepFn: vi.fn() },
    );
  });

  const validPayload = {
    eventId: '11111111-1111-4111-8111-111111111111',
    consultaId: '22222222-2222-4222-8222-222222222222',
    consultaFinalizadaEventId: '33333333-3333-4333-8333-333333333333',
    motivoCodigo: 'SERVICIO_INACTIVO',
    motivo: 'El servicio ENDO-01 se encuentra inactivo en el ERP',
    rechazadaEn: '2026-11-05T09:10:00.000Z',
  };

  it('1. Debe procesar payload válido, ejecutar el caso de uso y hacer ACK', async () => {
    const rawContent = JSON.stringify(validPayload);
    const mockMsg = {
      content: Buffer.from(rawContent),
      properties: {},
      fields: {},
    } as unknown as ConsumeMessage;

    await consumer.procesarMensaje(mockMsg, mockChannel as unknown as Channel);

    expect(mockUseCase.execute).toHaveBeenCalledWith({
      eventId: validPayload.eventId,
      consultaId: validPayload.consultaId,
      consultaFinalizadaEventId: validPayload.consultaFinalizadaEventId,
      motivoCodigo: validPayload.motivoCodigo,
      motivo: validPayload.motivo,
      rechazadaEn: new Date(validPayload.rechazadaEn),
    });
    expect(mockChannel.ack).toHaveBeenCalledWith(mockMsg);
    expect(mockChannel.nack).not.toHaveBeenCalled();
  });

  it('2. Debe enviar a DLQ (nack sin requeue) cuando el JSON es inválido o corrupto', async () => {
    const mockMsg = {
      content: Buffer.from('{ corrupt json...'),
      properties: {},
      fields: {},
    } as unknown as ConsumeMessage;

    await consumer.procesarMensaje(mockMsg, mockChannel as unknown as Channel);

    expect(mockChannel.nack).toHaveBeenCalledWith(mockMsg, false, false);
    expect(mockChannel.ack).not.toHaveBeenCalled();
    expect(mockUseCase.execute).not.toHaveBeenCalled();
  });

  it('3. Debe enviar a DLQ (nack sin requeue) cuando faltan campos requeridos por el contrato', async () => {
    const invalidPayload = {
      eventId: '11111111-1111-4111-8111-111111111111',
      consultaId: '22222222-2222-4222-8222-222222222222',
      // Falta consultaFinalizadaEventId
      motivoCodigo: 'SERVICIO_INACTIVO',
      motivo: 'Falta campo requerido',
      rechazadaEn: '2026-11-05T09:10:00.000Z',
    };
    const mockMsg = {
      content: Buffer.from(JSON.stringify(invalidPayload)),
      properties: {},
      fields: {},
    } as unknown as ConsumeMessage;

    await consumer.procesarMensaje(mockMsg, mockChannel as unknown as Channel);

    expect(mockChannel.nack).toHaveBeenCalledWith(mockMsg, false, false);
    expect(mockChannel.ack).not.toHaveBeenCalled();
    expect(mockUseCase.execute).not.toHaveBeenCalled();
  });

  it('4. Debe enviar a DLQ (nack sin requeue) cuando un UUID tiene formato inválido', async () => {
    const invalidUuidPayload = {
      ...validPayload,
      consultaId: 'no-es-un-uuid',
    };
    const mockMsg = {
      content: Buffer.from(JSON.stringify(invalidUuidPayload)),
      properties: {},
      fields: {},
    } as unknown as ConsumeMessage;

    await consumer.procesarMensaje(mockMsg, mockChannel as unknown as Channel);

    expect(mockChannel.nack).toHaveBeenCalledWith(mockMsg, false, false);
    expect(mockChannel.ack).not.toHaveBeenCalled();
    expect(mockUseCase.execute).not.toHaveBeenCalled();
  });

  it('5. Debe reintentar con backoff ante fallo transitorio y hacer ACK si un reintento tiene éxito', async () => {
    // Falla en el intento 1 pero tiene éxito en el intento 2
    mockUseCase.execute
      .mockRejectedValueOnce(new Error('MongoNetworkTimeoutException'))
      .mockResolvedValueOnce({ revertido: true, motivo: 'EXITO' });

    const mockMsg = {
      content: Buffer.from(JSON.stringify(validPayload)),
      properties: {},
      fields: {},
    } as unknown as ConsumeMessage;

    await consumer.procesarMensaje(mockMsg, mockChannel as unknown as Channel);

    expect(mockUseCase.execute).toHaveBeenCalledTimes(2);
    expect(mockChannel.ack).toHaveBeenCalledWith(mockMsg);
    expect(mockChannel.nack).not.toHaveBeenCalled();
  });

  it('6. Debe enviar a DLQ (nack sin requeue) y log estructurado al agotar reintentos por fallo transitorio', async () => {
    mockUseCase.execute.mockRejectedValue(new Error('MongoClusterUnavailableException'));

    const loggerErrorSpy = vi.spyOn((consumer as any).logger, 'error');

    const mockMsg = {
      content: Buffer.from(JSON.stringify(validPayload)),
      properties: {},
      fields: {},
    } as unknown as ConsumeMessage;

    await consumer.procesarMensaje(mockMsg, mockChannel as unknown as Channel);

    expect(mockUseCase.execute).toHaveBeenCalledTimes(4); // default 4 intentos
    expect(mockChannel.nack).toHaveBeenCalledWith(mockMsg, false, false); // DLQ
    expect(mockChannel.ack).not.toHaveBeenCalled();
    expect(loggerErrorSpy).toHaveBeenCalledWith(
      expect.objectContaining({
        message: expect.stringContaining('Reintentos agotados'),
        eventId: validPayload.eventId,
        consultaId: validPayload.consultaId,
        intentos: 4,
        maxIntentos: 4,
        error: 'MongoClusterUnavailableException',
      }),
    );
  });

  it('7. Debe hacer ACK (no DLQ) cuando la consulta no existe o no está completada (manejado por el use case)', async () => {
    // El caso de uso retorna revertido: false sin lanzar excepción
    mockUseCase.execute.mockResolvedValueOnce({ revertido: false, motivo: 'CONSULTA_NO_COMPLETADA' });

    const mockMsg = {
      content: Buffer.from(JSON.stringify(validPayload)),
      properties: {},
      fields: {},
    } as unknown as ConsumeMessage;

    await consumer.procesarMensaje(mockMsg, mockChannel as unknown as Channel);

    expect(mockChannel.ack).toHaveBeenCalledWith(mockMsg);
    expect(mockChannel.nack).not.toHaveBeenCalled();
  });

  it('8. Defecto Real Aceptación: procesarMensaje con UUID canónico pelado debe revertir consulta real a EN_CURSO con rechazoFacturacion', async () => {
    const mapaConsultas = new Map<string, ConsultaOdontologica>();
    const inMemoryConsultaRepo: IConsultaOdontologicaRepositoryPort = {
      guardar: vi.fn(async (c: ConsultaOdontologica) => {
        mapaConsultas.set(c.id.valor, c);
      }),
      buscarPorId: vi.fn(async (id: ConsultaId) => mapaConsultas.get(id.valor) ?? null),
      buscarPorHistoriaClinicaId: vi.fn(async () => []),
      buscarPorCitaId: vi.fn(async () => null),
      actualizar: vi.fn(async (c: ConsultaOdontologica) => {
        mapaConsultas.set(c.id.valor, c);
      }),
    };

    const inboxEventos = new Set<string>();
    const inMemoryInboxRepo: IInboxRepositoryPort = {
      existe: vi.fn(async (eventId: string) => inboxEventos.has(eventId)),
      guardar: vi.fn(async (item: { eventId: string }) => {
        inboxEventos.add(item.eventId);
      }),
    };

    const directUoW: IUnitOfWorkCompensacionPort = {
      ejecutarCompensacion: async (op) => await op(undefined),
    };

    const realUseCase = new RevertirCierrePorRechazoUseCase(
      inMemoryConsultaRepo,
      inMemoryInboxRepo,
      directUoW,
    );

    const integrationConsumer = new FacturacionRechazadaConsumer(
      realUseCase,
      undefined,
      { enabled: false, initialBackoffMs: 0, maxBackoffMs: 0, sleepFn: vi.fn() },
    );

    // Crear consulta completada
    const consulta = ConsultaOdontologica.abrir({
      historiaClinicaId: HistoriaClinicaId.crear('hc_123'),
      pacienteId: PacienteId.crear('pac_123'),
      odontologoId: OdontologoId.crear('od_001'),
      versionHistoriaReferenciada: 1,
      snapshotRiesgoClinico: SnapshotRiesgoClinico.vacio(),
      motivoConsulta: MotivoConsulta.crear('Dolor agudo en pieza molar'),
      exploracionFisica: ExploracionFisica.crear({
        inspeccionIntraoral: 'Cavidad profunda en cara oclusal de pieza 16',
      }),
      diagnosticos: [
        DiagnosticoItem.crear({
          codigoCIE: 'K02.1',
          descripcion: 'Caries de la dentina',
          tipo: TipoDiagnostico.DEFINITIVO,
        }),
      ],
      fechaAtencion: new Date('2026-11-05T08:00:00.000Z'),
    });

    consulta.completar(
      OdontologoId.crear('od_001'),
      {
        serviciosFacturables: [
          ServicioFacturableConsulta.crear({
            servicioId: '550e8400-e29b-41d4-a716-446655440001',
            codigo: 'REST-01',
            nombre: 'Restauración Resina',
            precioUnitarioBs: '120.00',
            cantidad: 1,
            piezaDental: 16,
          }),
        ],
        ahora: new Date('2026-11-05T09:00:00.000Z'),
      },
    );

    const outboxCierreId = '33333333-3333-4333-8333-333333333333';
    consulta.asignarUltimoOutboxEventId(outboxCierreId);
    await inMemoryConsultaRepo.guardar(consulta);

    // El ERP envía consultaId como UUID puro (toCanonicalUuid), sin prefijo cons_
    const bareUuid = consulta.id.toCanonicalUuid();
    expect(bareUuid.startsWith('cons_')).toBe(false);

    const payloadRechazo = {
      eventId: '99999999-9999-4999-8999-999999999999',
      consultaId: bareUuid, // UUID CANÓNICO PELADO
      consultaFinalizadaEventId: outboxCierreId,
      motivoCodigo: 'SERVICIO_INACTIVO',
      motivo: 'El servicio REST-01 se encuentra inactivo en el ERP',
      rechazadaEn: '2026-11-05T09:10:00.000Z',
    };

    const mockMsg = {
      content: Buffer.from(JSON.stringify(payloadRechazo)),
      properties: {},
      fields: {},
    } as unknown as ConsumeMessage;

    await integrationConsumer.procesarMensaje(mockMsg, mockChannel as unknown as Channel);

    expect(mockChannel.ack).toHaveBeenCalledWith(mockMsg);

    // Invariante de negocio: la consulta DEBE estar en EN_CURSO y tener rechazoFacturacion registrado
    const consultaRevisada = await inMemoryConsultaRepo.buscarPorId(consulta.id);
    expect(consultaRevisada?.estado).toBe(EstadoConsulta.EN_CURSO);
    expect(consultaRevisada?.rechazoFacturacion).toBeDefined();
    expect(consultaRevisada?.rechazoFacturacion?.motivoCodigo).toBe('SERVICIO_INACTIVO');
    expect(consultaRevisada?.rechazoFacturacion?.motivo).toBe('El servicio REST-01 se encuentra inactivo en el ERP');
  });

  it('9. Rama de ID inválido: debe emitir log WARN estructurado con eventId y consultaId (sin PII)', async () => {
    const mapaConsultas = new Map<string, ConsultaOdontologica>();
    const inMemoryConsultaRepo: IConsultaOdontologicaRepositoryPort = {
      guardar: vi.fn(),
      buscarPorId: vi.fn(async (id: ConsultaId) => mapaConsultas.get(id.valor) ?? null),
      buscarPorHistoriaClinicaId: vi.fn(async () => []),
      buscarPorCitaId: vi.fn(async () => null),
      actualizar: vi.fn(),
    };

    const inMemoryInboxRepo: IInboxRepositoryPort = {
      existe: vi.fn(async () => false),
      guardar: vi.fn(async () => {}),
    };

    const directUoW: IUnitOfWorkCompensacionPort = {
      ejecutarCompensacion: async (op) => await op(undefined),
    };

    const realUseCase = new RevertirCierrePorRechazoUseCase(
      inMemoryConsultaRepo,
      inMemoryInboxRepo,
      directUoW,
    );

    const useCaseWarnSpy = vi.spyOn((realUseCase as any).logger, 'warn');

    const res = await realUseCase.execute({
      eventId: '99999999-9999-4999-8999-999999999999',
      consultaId: 'invalid-non-uuid-and-non-cons',
      consultaFinalizadaEventId: '33333333-3333-4333-8333-333333333333',
      motivoCodigo: 'SERVICIO_INACTIVO',
      motivo: 'Motivo prueba',
      rechazadaEn: '2026-11-05T09:10:00.000Z',
    });

    expect(res.revertido).toBe(false);
    expect(res.motivo).toBe('CONSULTA_NO_ENCONTRADA');
    expect(useCaseWarnSpy).toHaveBeenCalledWith(
      expect.objectContaining({
        message: expect.stringContaining('Formato de consultaId inválido'),
        eventId: '99999999-9999-4999-8999-999999999999',
        consultaId: 'invalid-non-uuid-and-non-cons',
      }),
    );
  });
});
