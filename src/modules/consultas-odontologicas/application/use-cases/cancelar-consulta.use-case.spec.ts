import { describe, it, expect, vi, beforeEach } from 'vitest';
import { CancelarConsultaUseCase } from './cancelar-consulta.use-case.js';
import type { IConsultaOdontologicaRepositoryPort } from '../../domain/ports/consulta-odontologica.repository.port.js';
import type { IOdontologoContextPort } from '../../domain/ports/odontologo-context.port.js';
import { ConsultaNoEncontradaError } from '../../domain/errors/consulta-no-encontrada.error.js';
import { ConflictoConcurrenteConsultaError } from '../../domain/errors/conflicto-concurrente-consulta.error.js';
import { JustificacionCancelacionRequeridaError } from '../../domain/errors/justificacion-cancelacion-requerida.error.js';
import { TransicionEstadoConsultaInvalidaError } from '../../domain/errors/transicion-estado-consulta-invalida.error.js';
import { AutenticacionRequeridaError } from '../errors/autenticacion-requerida.error.js';
import { ConsultaOdontologica } from '../../domain/entities/consulta-odontologica.entity.js';
import { HistoriaClinicaId } from '../../domain/value-objects/historia-clinica-id.vo.js';
import { PacienteId } from '../../domain/value-objects/paciente-id.vo.js';
import { OdontologoId } from '../../domain/value-objects/odontologo-id.vo.js';
import { MotivoConsulta } from '../../domain/value-objects/motivo-consulta.vo.js';
import { SnapshotRiesgoClinico } from '../../domain/value-objects/snapshot-riesgo-clinico.vo.js';
import { EstadoConsulta } from '../../domain/value-objects/estado-consulta.enum.js';

describe('CancelarConsultaUseCase', () => {
  let useCase: CancelarConsultaUseCase;
  let mockRepository: { [K in keyof IConsultaOdontologicaRepositoryPort]: ReturnType<typeof vi.fn> };
  let mockOdontologoContext: { [K in keyof IOdontologoContextPort]: ReturnType<typeof vi.fn> };

  const relojCancelacion = new Date('2026-10-22T10:45:00.000Z');

  const crearConsultaMock = (): ConsultaOdontologica => {
    return ConsultaOdontologica.abrir({
      historiaClinicaId: HistoriaClinicaId.crear('hc_123'),
      pacienteId: PacienteId.crear('pac_123'),
      odontologoId: OdontologoId.crear('od_001'),
      versionHistoriaReferenciada: 1,
      snapshotRiesgoClinico: SnapshotRiesgoClinico.vacio(),
      motivoConsulta: MotivoConsulta.crear('Dolor en pieza 36'),
    });
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

    useCase = new CancelarConsultaUseCase(
      mockRepository as unknown as IConsultaOdontologicaRepositoryPort,
      mockOdontologoContext as unknown as IOdontologoContextPort
    );
  });

  it('debe cancelar la consulta registrando la justificación obligatoria exitosamente', async () => {
    const consulta = crearConsultaMock();
    mockRepository.buscarPorId.mockResolvedValue(consulta);

    const motivo = 'Paciente experimenta reacción alérgica leve; se suspende y deriva.';
    const result = await useCase.execute(
      {
        tokenAutenticacion: 'token_valido',
        consultaId: consulta.id.valor,
        versionEsperada: consulta.version,
        motivoCancelacion: motivo,
      },
      relojCancelacion
    );

    expect(result.estado).toBe(EstadoConsulta.CANCELADA);
    expect(result.motivoCancelacion).toBe(motivo);
    expect(result.cerradaEn).toBe(relojCancelacion.toISOString());
    expect(mockRepository.actualizar).toHaveBeenCalled();
  });

  it('debe rechazar si no se envía token de autenticación', async () => {
    await expect(
      useCase.execute({
        tokenAutenticacion: '',
        consultaId: 'cons_123',
        versionEsperada: 1,
        motivoCancelacion: 'Motivo válido de cancelación',
      })
    ).rejects.toThrow(AutenticacionRequeridaError);
  });

  it('debe rechazar si la consulta no existe', async () => {
    mockRepository.buscarPorId.mockResolvedValue(null);

    await expect(
      useCase.execute({
        tokenAutenticacion: 'token_valido',
        consultaId: 'cons_no_existe',
        versionEsperada: 1,
        motivoCancelacion: 'Motivo justificado',
      })
    ).rejects.toThrow(ConsultaNoEncontradaError);
  });

  it('debe rechazar por conflicto de concurrencia optimista si la versión esperada no coincide', async () => {
    const consulta = crearConsultaMock();
    mockRepository.buscarPorId.mockResolvedValue(consulta);

    await expect(
      useCase.execute({
        tokenAutenticacion: 'token_valido',
        consultaId: consulta.id.valor,
        versionEsperada: 99,
        motivoCancelacion: 'Justificación médica válida',
      })
    ).rejects.toThrow(ConflictoConcurrenteConsultaError);
  });

  it('debe rechazar si la justificación es vacía o menor a 10 caracteres (INV-CONS-06)', async () => {
    const consulta = crearConsultaMock();
    mockRepository.buscarPorId.mockResolvedValue(consulta);

    await expect(
      useCase.execute({
        tokenAutenticacion: 'token_valido',
        consultaId: consulta.id.valor,
        versionEsperada: consulta.version,
        motivoCancelacion: 'Breve',
      })
    ).rejects.toThrow(JustificacionCancelacionRequeridaError);
  });

  it('debe rechazar cancelar una consulta que ya fue cancelada previamente', async () => {
    const consulta = crearConsultaMock();
    consulta.cancelar('Cancelación previa justificada', OdontologoId.crear('od_001'));
    mockRepository.buscarPorId.mockResolvedValue(consulta);

    await expect(
      useCase.execute({
        tokenAutenticacion: 'token_valido',
        consultaId: consulta.id.valor,
        versionEsperada: consulta.version,
        motivoCancelacion: 'Nuevo intento de cancelación',
      })
    ).rejects.toThrow(TransicionEstadoConsultaInvalidaError);
  });
});
