import { describe, it, expect, vi, beforeEach } from 'vitest';
import { CompletarConsultaUseCase } from './completar-consulta.use-case.js';
import type { IConsultaOdontologicaRepositoryPort } from '../../domain/ports/consulta-odontologica.repository.port.js';
import type { IOdontologoContextPort } from '../../domain/ports/odontologo-context.port.js';
import type { ICatalogoServiciosPort, ServicioCatalogoDto } from '../ports/catalogo-servicios.port.js';
import type { IUnitOfWorkCierreConsultaPort } from '../ports/unit-of-work-cierre-consulta.port.js';
import { ConsultaNoEncontradaError } from '../../domain/errors/consulta-no-encontrada.error.js';
import { ConflictoConcurrenteConsultaError } from '../../domain/errors/conflicto-concurrente-consulta.error.js';
import { RequisitosCierreConsultaIncumplidosError } from '../../domain/errors/requisitos-cierre-consulta-incumplidos.error.js';
import { TransicionEstadoConsultaInvalidaError } from '../../domain/errors/transicion-estado-consulta-invalida.error.js';
import { ServicioFacturableInvalidoError } from '../../domain/errors/servicio-facturable-invalido.error.js';
import { TransaccionesNoSoportadasError } from '../../domain/errors/transacciones-no-soportadas.error.js';
import { AutenticacionRequeridaError } from '../errors/autenticacion-requerida.error.js';
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
import { OutboxEvent } from '../../../outbox/domain/entities/outbox-event.entity.js';

describe('CompletarConsultaUseCase', () => {
  let useCase: CompletarConsultaUseCase;
  let mockRepository: { [K in keyof IConsultaOdontologicaRepositoryPort]: ReturnType<typeof vi.fn> };
  let mockOdontologoContext: { [K in keyof IOdontologoContextPort]: ReturnType<typeof vi.fn> };
  let mockCatalogoServicios: { [K in keyof ICatalogoServiciosPort]: ReturnType<typeof vi.fn> };
  let mockUnitOfWork: { [K in keyof IUnitOfWorkCierreConsultaPort]: ReturnType<typeof vi.fn> };

  const relojCierre = new Date('2026-10-22T11:00:00.000Z');
  const SERVICIO_ACTIVO_ID = '550e8400-e29b-41d4-a716-446655440001';
  const SERVICIO_INACTIVO_ID = '550e8400-e29b-41d4-a716-446655440002';

  const mockServicioActivo: ServicioCatalogoDto = {
    id: SERVICIO_ACTIVO_ID,
    codigo: 'LIM-001',
    nombre: 'Limpieza Dental Ultrasonido',
    descripcion: 'Profilaxis dental completa',
    precioBaseBs: '150.00',
    activo: true,
  };

  const mockServicioInactivo: ServicioCatalogoDto = {
    id: SERVICIO_INACTIVO_ID,
    codigo: 'OBS-002',
    nombre: 'Servicio Obsoleto',
    descripcion: 'Descontinuado',
    precioBaseBs: '50.00',
    activo: false,
  };

  const crearConsultaConRequisitos = (): ConsultaOdontologica => {
    const consulta = ConsultaOdontologica.abrir({
      historiaClinicaId: HistoriaClinicaId.crear('hc_123'),
      pacienteId: PacienteId.crear('pac_123'),
      odontologoId: OdontologoId.crear('od_001'),
      versionHistoriaReferenciada: 1,
      snapshotRiesgoClinico: SnapshotRiesgoClinico.vacio(),
      motivoConsulta: MotivoConsulta.crear('Dolor en pieza 36'),
    });

    consulta.actualizarAtencion({
      exploracionFisica: ExploracionFisica.crear({
        inspeccionIntraoral: 'Cavidad ocluso-distal profunda evaluada sin fístulas.',
      }),
      diagnosticos: [
        DiagnosticoItem.crear({
          codigoCIE10: 'K04.0',
          descripcion: 'Pulpitis irreversible sintomática',
          tipo: TipoDiagnostico.DEFINITIVO,
        }),
      ],
      actualizadoPor: OdontologoId.crear('od_001'),
    });

    return consulta;
  };

  beforeEach(() => {
    mockRepository = {
      guardar: vi.fn(),
      actualizar: vi.fn().mockResolvedValue(undefined),
      buscarPorId: vi.fn(),
      buscarPorCitaId: vi.fn(),
      listarPorHistoriaClinica: vi.fn(),
      listarPorPacienteId: vi.fn(),
    };

    mockOdontologoContext = {
      obtenerOdontologoActual: vi.fn().mockResolvedValue({ odontologoId: 'od_001' }),
    };

    mockCatalogoServicios = {
      listarServiciosActivos: vi.fn().mockResolvedValue([mockServicioActivo]),
      obtenerServicioPorId: vi.fn().mockImplementation((id: string) => {
        if (id === SERVICIO_ACTIVO_ID) return Promise.resolve(mockServicioActivo);
        if (id === SERVICIO_INACTIVO_ID) return Promise.resolve(mockServicioInactivo);
        return Promise.resolve(null);
      }),
    };

    mockUnitOfWork = {
      ejecutarCierreConOutbox: vi.fn().mockResolvedValue(undefined),
    };

    useCase = new CompletarConsultaUseCase(
      mockRepository as unknown as IConsultaOdontologicaRepositoryPort,
      mockOdontologoContext as unknown as IOdontologoContextPort,
      mockCatalogoServicios as unknown as ICatalogoServiciosPort,
      mockUnitOfWork as unknown as IUnitOfWorkCierreConsultaPort,
    );
  });

  it('1. debe completar y sellar la consulta sin servicios facturables sin transacción Outbox (consulta sin cobro)', async () => {
    const consulta = crearConsultaConRequisitos();
    mockRepository.buscarPorId.mockResolvedValue(consulta);

    const result = await useCase.execute(
      {
        tokenAutenticacion: 'token_valido',
        consultaId: consulta.id.valor,
        versionEsperada: consulta.version,
      },
      relojCierre,
    );

    expect(result.estado).toBe(EstadoConsulta.COMPLETADA);
    expect(result.cerradaEn).toBe(relojCierre.toISOString());
    expect(result.serviciosFacturables).toEqual([]);
    expect(result.totalFacturableBs).toBe('0.00');
    // Consulta sin cobro: se actualiza directamente sin Unit of Work
    expect(mockRepository.actualizar).toHaveBeenCalledWith(consulta, 2);
    expect(mockUnitOfWork.ejecutarCierreConOutbox).not.toHaveBeenCalled();
  });

  it('2. debe delegar al Unit of Work para persistencia atómica con Outbox al completar con servicios facturables', async () => {
    const consulta = crearConsultaConRequisitos();
    mockRepository.buscarPorId.mockResolvedValue(consulta);

    const result = await useCase.execute(
      {
        tokenAutenticacion: 'token_valido',
        consultaId: consulta.id.valor,
        versionEsperada: consulta.version,
        serviciosFacturables: [
          {
            servicioId: SERVICIO_ACTIVO_ID,
            cantidad: 2,
            piezaDental: 16,
          },
        ],
        observacionesCobro: 'Factura con NIT',
      },
      relojCierre,
    );

    expect(result.estado).toBe(EstadoConsulta.COMPLETADA);
    expect(result.serviciosFacturables).toHaveLength(1);
    expect(result.serviciosFacturables[0]).toEqual({
      servicioId: SERVICIO_ACTIVO_ID,
      codigo: 'LIM-001',
      nombre: 'Limpieza Dental Ultrasonido',
      cantidad: 2,
      precioUnitarioBs: '150.00',
      subtotalBs: '300.00',
      piezaDental: 16,
    });
    expect(result.totalFacturableBs).toBe('300.00');
    expect(result.observacionesCobro).toBe('Factura con NIT');

    // Consulta con cobro: se delega exclusivamente al Unit of Work
    expect(mockUnitOfWork.ejecutarCierreConOutbox).toHaveBeenCalledTimes(1);
    const [consultaPasada, versionPasada, eventoPasado] =
      mockUnitOfWork.ejecutarCierreConOutbox.mock.calls[0] as [ConsultaOdontologica, number, OutboxEvent];

    expect(consultaPasada).toBe(consulta);
    expect(versionPasada).toBe(2);
    expect(eventoPasado).toBeInstanceOf(OutboxEvent);
    expect(eventoPasado.eventType).toBe('clinica.consulta.finalizada');
    expect(eventoPasado.exchange).toBe('dental.topic.exchange');
    expect(eventoPasado.routingKey).toBe('clinica.consulta.finalizada');
    expect(eventoPasado.payload.serviciosRealizados).toBeDefined();

    // No debe llamarse a actualizar por fuera del Unit of Work
    expect(mockRepository.actualizar).not.toHaveBeenCalled();
  });

  it('3. debe rechazar si un servicio facturable no existe en el catálogo de MS1', async () => {
    const consulta = crearConsultaConRequisitos();
    mockRepository.buscarPorId.mockResolvedValue(consulta);

    await expect(
      useCase.execute({
        tokenAutenticacion: 'token_valido',
        consultaId: consulta.id.valor,
        versionEsperada: consulta.version,
        serviciosFacturables: [
          {
            servicioId: '550e8400-e29b-41d4-a716-446655449999',
            cantidad: 1,
          },
        ],
      }),
    ).rejects.toThrow(ServicioFacturableInvalidoError);
    expect(mockUnitOfWork.ejecutarCierreConOutbox).not.toHaveBeenCalled();
    expect(mockRepository.actualizar).not.toHaveBeenCalled();
  });

  it('4. debe rechazar si un servicio facturable está inactivo en el catálogo de MS1', async () => {
    const consulta = crearConsultaConRequisitos();
    mockRepository.buscarPorId.mockResolvedValue(consulta);

    await expect(
      useCase.execute({
        tokenAutenticacion: 'token_valido',
        consultaId: consulta.id.valor,
        versionEsperada: consulta.version,
        serviciosFacturables: [
          {
            servicioId: SERVICIO_INACTIVO_ID,
            cantidad: 1,
          },
        ],
      }),
    ).rejects.toThrow(/se encuentra inactivo en MS1/);
    expect(mockUnitOfWork.ejecutarCierreConOutbox).not.toHaveBeenCalled();
    expect(mockRepository.actualizar).not.toHaveBeenCalled();
  });

  it('5. debe rechazar si no se envía token de autenticación', async () => {
    await expect(
      useCase.execute({
        tokenAutenticacion: '',
        consultaId: 'cons_123',
        versionEsperada: 1,
      }),
    ).rejects.toThrow(AutenticacionRequeridaError);
  });

  it('6. debe rechazar si la consulta no existe', async () => {
    mockRepository.buscarPorId.mockResolvedValue(null);

    await expect(
      useCase.execute({
        tokenAutenticacion: 'token_valido',
        consultaId: 'cons_no_existe',
        versionEsperada: 1,
      }),
    ).rejects.toThrow(ConsultaNoEncontradaError);
  });

  it('7. debe rechazar por conflicto de concurrencia optimista si la versión esperada no coincide en memoria', async () => {
    const consulta = crearConsultaConRequisitos();
    mockRepository.buscarPorId.mockResolvedValue(consulta);

    await expect(
      useCase.execute({
        tokenAutenticacion: 'token_valido',
        consultaId: consulta.id.valor,
        versionEsperada: 99,
      }),
    ).rejects.toThrow(ConflictoConcurrenteConsultaError);
  });

  it('8. debe rechazar si no cumple con los requisitos mínimos clínicos (INV-CONS-05)', async () => {
    const consultaIncompleta = ConsultaOdontologica.abrir({
      historiaClinicaId: HistoriaClinicaId.crear('hc_123'),
      pacienteId: PacienteId.crear('pac_123'),
      odontologoId: OdontologoId.crear('od_001'),
      versionHistoriaReferenciada: 1,
      snapshotRiesgoClinico: SnapshotRiesgoClinico.vacio(),
      motivoConsulta: MotivoConsulta.crear('Dolor en pieza 36'),
    });
    mockRepository.buscarPorId.mockResolvedValue(consultaIncompleta);

    await expect(
      useCase.execute({
        tokenAutenticacion: 'token_valido',
        consultaId: consultaIncompleta.id.valor,
        versionEsperada: 1,
      }),
    ).rejects.toThrow(RequisitosCierreConsultaIncumplidosError);
  });

  it('9. debe rechazar completar si ya fue completada previamente', async () => {
    const consulta = crearConsultaConRequisitos();
    consulta.completar(OdontologoId.crear('od_001'));
    mockRepository.buscarPorId.mockResolvedValue(consulta);

    await expect(
      useCase.execute({
        tokenAutenticacion: 'token_valido',
        consultaId: consulta.id.valor,
        versionEsperada: consulta.version,
      }),
    ).rejects.toThrow(TransicionEstadoConsultaInvalidaError);
  });

  it('10. debe rechazar con TransaccionesNoSoportadasError si la BD es Standalone y no persistir nada', async () => {
    const consulta = crearConsultaConRequisitos();
    mockRepository.buscarPorId.mockResolvedValue(consulta);
    mockUnitOfWork.ejecutarCierreConOutbox.mockRejectedValue(
      new TransaccionesNoSoportadasError(),
    );

    await expect(
      useCase.execute(
        {
          tokenAutenticacion: 'token_valido',
          consultaId: consulta.id.valor,
          versionEsperada: consulta.version,
          serviciosFacturables: [
            {
              servicioId: SERVICIO_ACTIVO_ID,
              cantidad: 1,
            },
          ],
        },
        relojCierre,
      ),
    ).rejects.toThrow(TransaccionesNoSoportadasError);

    expect(mockRepository.actualizar).not.toHaveBeenCalled();
  });

  it('11. debe propagar ConflictoConcurrenteConsultaError si el Unit of Work detecta colisión optimista', async () => {
    const consulta = crearConsultaConRequisitos();
    mockRepository.buscarPorId.mockResolvedValue(consulta);
    mockUnitOfWork.ejecutarCierreConOutbox.mockRejectedValue(
      new ConflictoConcurrenteConsultaError(consulta.id.valor, consulta.version),
    );

    await expect(
      useCase.execute(
        {
          tokenAutenticacion: 'token_valido',
          consultaId: consulta.id.valor,
          versionEsperada: consulta.version,
          serviciosFacturables: [
            {
              servicioId: SERVICIO_ACTIVO_ID,
              cantidad: 1,
            },
          ],
        },
        relojCierre,
      ),
    ).rejects.toThrow(ConflictoConcurrenteConsultaError);
  });
});
