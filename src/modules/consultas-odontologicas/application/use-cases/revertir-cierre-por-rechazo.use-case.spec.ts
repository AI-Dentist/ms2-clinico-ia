import { describe, it, expect, vi, beforeEach } from 'vitest';
import { RevertirCierrePorRechazoUseCase } from './revertir-cierre-por-rechazo.use-case.js';
import type { IConsultaOdontologicaRepositoryPort } from '../../domain/ports/consulta-odontologica.repository.port.js';
import type { IInboxRepositoryPort } from '../ports/inbox-repository.port.js';
import type { IUnitOfWorkCompensacionPort } from '../ports/unit-of-work-compensacion.port.js';
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

describe('RevertirCierrePorRechazoUseCase (Saga T3)', () => {
  let useCase: RevertirCierrePorRechazoUseCase;
  let mockConsultaRepository: { [K in keyof IConsultaOdontologicaRepositoryPort]: ReturnType<typeof vi.fn> };
  let mockInboxRepository: { [K in keyof IInboxRepositoryPort]: ReturnType<typeof vi.fn> };
  let mockUnitOfWork: { [K in keyof IUnitOfWorkCompensacionPort]: ReturnType<typeof vi.fn> };

  const OUTBOX_EVENT_ID_ACTUAL = 'outbox-cierre-001';
  const SERVICIO_ID = '550e8400-e29b-41d4-a716-446655440001';

  function crearConsultaCompletada(): ConsultaOdontologica {
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
            servicioId: SERVICIO_ID,
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

    consulta.asignarUltimoOutboxEventId(OUTBOX_EVENT_ID_ACTUAL);
    return consulta;
  }

  beforeEach(() => {
    mockConsultaRepository = {
      guardar: vi.fn(),
      buscarPorId: vi.fn(),
      buscarPorHistoriaClinicaId: vi.fn(),
      buscarPorCitaId: vi.fn(),
      actualizar: vi.fn(),
    };

    mockInboxRepository = {
      existe: vi.fn().mockResolvedValue(false),
      guardar: vi.fn().mockResolvedValue(undefined),
    };

    mockUnitOfWork = {
      ejecutarCompensacion: vi.fn().mockImplementation(async (operacion) => {
        return operacion({} as any);
      }),
    };

    useCase = new RevertirCierrePorRechazoUseCase(
      mockConsultaRepository as unknown as IConsultaOdontologicaRepositoryPort,
      mockInboxRepository as unknown as IInboxRepositoryPort,
      mockUnitOfWork as unknown as IUnitOfWorkCompensacionPort,
    );
  });

  it('1. debe revertir exitosamente una consulta COMPLETADA cuando consultaFinalizadaEventId coincide con el cierre vigente', async () => {
    const consulta = crearConsultaCompletada();
    mockConsultaRepository.buscarPorId.mockResolvedValue(consulta);

    const resultado = await useCase.execute({
      eventId: 'rechazo-evt-001',
      consultaId: consulta.id.valor,
      consultaFinalizadaEventId: OUTBOX_EVENT_ID_ACTUAL,
      motivoCodigo: 'SERVICIO_INACTIVO',
      motivo: 'El servicio REST-01 se encuentra inactivo en el catálogo del ERP',
      rechazadaEn: '2026-11-05T09:10:00.000Z',
    });

    expect(resultado.revertido).toBe(true);
    expect(consulta.estado).toBe(EstadoConsulta.EN_CURSO);
    expect(consulta.cerradaEn).toBeNull();
    expect(consulta.rechazoFacturacion).toEqual({
      motivoCodigo: 'SERVICIO_INACTIVO',
      motivo: 'El servicio REST-01 se encuentra inactivo en el catálogo del ERP',
      rechazadaEn: new Date('2026-11-05T09:10:00.000Z'),
    });
    expect(mockUnitOfWork.ejecutarCompensacion).toHaveBeenCalledTimes(1);
    expect(mockInboxRepository.guardar).toHaveBeenCalledWith(
      expect.objectContaining({ eventId: 'rechazo-evt-001' }),
      expect.anything(),
    );
  });

  it('2. debe ser idempotente: si el eventId ya existe en el inbox, retorna sin revertir de nuevo', async () => {
    const consulta = crearConsultaCompletada();
    mockConsultaRepository.buscarPorId.mockResolvedValue(consulta);
    mockInboxRepository.existe.mockResolvedValue(true);

    const resultado = await useCase.execute({
      eventId: 'rechazo-evt-duplicado',
      consultaId: consulta.id.valor,
      consultaFinalizadaEventId: OUTBOX_EVENT_ID_ACTUAL,
      motivoCodigo: 'SERVICIO_INACTIVO',
      motivo: 'Rechazo duplicado',
      rechazadaEn: '2026-11-05T09:10:00.000Z',
    });

    expect(resultado.revertido).toBe(false);
    expect(resultado.motivo).toBe('DUPLICADO');
    expect(consulta.estado).toBe(EstadoConsulta.COMPLETADA);
    expect(mockConsultaRepository.actualizar).not.toHaveBeenCalled();
  });

  it('3. debe ignorar la reversión si consultaFinalizadaEventId no coincide con el cierre vigente (guard de versión)', async () => {
    const consulta = crearConsultaCompletada();
    // La consulta tiene un cierre más reciente con otro Outbox ID
    consulta.asignarUltimoOutboxEventId('outbox-cierre-nuevo-999');
    mockConsultaRepository.buscarPorId.mockResolvedValue(consulta);

    const resultado = await useCase.execute({
      eventId: 'rechazo-evt-obsoleto',
      consultaId: consulta.id.valor,
      consultaFinalizadaEventId: 'outbox-cierre-antiguo-000',
      motivoCodigo: 'PACIENTE_INEXISTENTE',
      motivo: 'Rechazo perteneciente a un cierre anterior ya superado',
      rechazadaEn: '2026-11-05T09:10:00.000Z',
    });

    expect(resultado.revertido).toBe(false);
    expect(resultado.motivo).toBe('EVENTO_CIERRE_OBSOLETO');
    expect(consulta.estado).toBe(EstadoConsulta.COMPLETADA);
    // Debe persistir en inbox para no procesar reintentos futuros
    expect(mockInboxRepository.guardar).toHaveBeenCalled();
  });

  it('4. debe descartar sin error si la consulta no existe (no envía a DLQ)', async () => {
    mockConsultaRepository.buscarPorId.mockResolvedValue(null);

    const resultado = await useCase.execute({
      eventId: 'rechazo-evt-fantasma',
      consultaId: 'cons_inexistente',
      consultaFinalizadaEventId: 'outbox-001',
      motivoCodigo: 'PAYLOAD_INVALIDO',
      motivo: 'Consulta inexistente',
      rechazadaEn: '2026-11-05T09:10:00.000Z',
    });

    expect(resultado.revertido).toBe(false);
    expect(resultado.motivo).toBe('CONSULTA_NO_ENCONTRADA');
    expect(mockInboxRepository.guardar).toHaveBeenCalled();
  });

  it('5. debe descartar sin revertir si la consulta no está en estado COMPLETADA', async () => {
    const consulta = crearConsultaCompletada();
    // Forzamos a EN_CURSO
    consulta.revertirCierrePorRechazoFacturacion({
      motivoCodigo: 'OTRO',
      motivo: 'Ya revertida',
      rechazadaEn: new Date(),
    });
    mockConsultaRepository.buscarPorId.mockResolvedValue(consulta);

    const resultado = await useCase.execute({
      eventId: 'rechazo-evt-otra-vez',
      consultaId: consulta.id.valor,
      consultaFinalizadaEventId: OUTBOX_EVENT_ID_ACTUAL,
      motivoCodigo: 'SERVICIO_INACTIVO',
      motivo: 'Segundo rechazo',
      rechazadaEn: '2026-11-05T09:10:00.000Z',
    });

    expect(resultado.revertido).toBe(false);
    expect(resultado.motivo).toBe('CONSULTA_NO_COMPLETADA');
  });
});
