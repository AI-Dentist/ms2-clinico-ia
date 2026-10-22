import { describe, it, expect, vi, beforeEach } from 'vitest';
import { CompletarConsultaUseCase } from './completar-consulta.use-case.js';
import type { IConsultaOdontologicaRepositoryPort } from '../../domain/ports/consulta-odontologica.repository.port.js';
import type { IOdontologoContextPort } from '../../domain/ports/odontologo-context.port.js';
import { ConsultaNoEncontradaError } from '../../domain/errors/consulta-no-encontrada.error.js';
import { ConflictoConcurrenteConsultaError } from '../../domain/errors/conflicto-concurrente-consulta.error.js';
import { RequisitosCierreConsultaIncumplidosError } from '../../domain/errors/requisitos-cierre-consulta-incumplidos.error.js';
import { TransicionEstadoConsultaInvalidaError } from '../../domain/errors/transicion-estado-consulta-invalida.error.js';
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

describe('CompletarConsultaUseCase', () => {
  let useCase: CompletarConsultaUseCase;
  let mockRepository: { [K in keyof IConsultaOdontologicaRepositoryPort]: ReturnType<typeof vi.fn> };
  let mockOdontologoContext: { [K in keyof IOdontologoContextPort]: ReturnType<typeof vi.fn> };

  const relojCierre = new Date('2026-10-22T11:00:00.000Z');

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

    useCase = new CompletarConsultaUseCase(
      mockRepository as unknown as IConsultaOdontologicaRepositoryPort,
      mockOdontologoContext as unknown as IOdontologoContextPort
    );
  });

  it('debe completar y sellar la consulta exitosamente cumpliendo requisitos mínimos clínicos', async () => {
    const consulta = crearConsultaConRequisitos();
    mockRepository.buscarPorId.mockResolvedValue(consulta);

    const result = await useCase.execute(
      {
        tokenAutenticacion: 'token_valido',
        consultaId: consulta.id.valor,
        versionEsperada: consulta.version,
      },
      relojCierre
    );

    expect(result.estado).toBe(EstadoConsulta.COMPLETADA);
    expect(result.cerradaEn).toBe(relojCierre.toISOString());
    expect(result.version).toBe(consulta.version); // Incrementó en completar()
    expect(mockRepository.actualizar).toHaveBeenCalled();
  });

  it('debe rechazar si no se envía token de autenticación', async () => {
    await expect(
      useCase.execute({
        tokenAutenticacion: '',
        consultaId: 'cons_123',
        versionEsperada: 1,
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
      })
    ).rejects.toThrow(ConsultaNoEncontradaError);
  });

  it('debe rechazar por conflicto de concurrencia optimista si la versión esperada no coincide', async () => {
    const consulta = crearConsultaConRequisitos();
    mockRepository.buscarPorId.mockResolvedValue(consulta);

    await expect(
      useCase.execute({
        tokenAutenticacion: 'token_valido',
        consultaId: consulta.id.valor,
        versionEsperada: 99,
      })
    ).rejects.toThrow(ConflictoConcurrenteConsultaError);
  });

  it('debe rechazar si no cumple con los requisitos mínimos clínicos (INV-CONS-05)', async () => {
    // Consulta abierta sin exploración ni diagnósticos
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
      })
    ).rejects.toThrow(RequisitosCierreConsultaIncumplidosError);
  });

  it('debe rechazar completar si ya fue completada previamente', async () => {
    const consulta = crearConsultaConRequisitos();
    consulta.completar(OdontologoId.crear('od_001'));
    mockRepository.buscarPorId.mockResolvedValue(consulta);

    await expect(
      useCase.execute({
        tokenAutenticacion: 'token_valido',
        consultaId: consulta.id.valor,
        versionEsperada: consulta.version,
      })
    ).rejects.toThrow(TransicionEstadoConsultaInvalidaError);
  });
});
