import { describe, it, expect, vi, beforeEach } from 'vitest';
import { ListarConsultasPorHistoriaUseCase } from './listar-consultas-por-historia.use-case.js';
import type { IConsultaOdontologicaRepositoryPort } from '../../domain/ports/consulta-odontologica.repository.port.js';
import type { IHistoriaClinicaContextPort } from '../../domain/ports/historia-clinica-context.port.js';
import type { IOdontologoContextPort } from '../../domain/ports/odontologo-context.port.js';
import { HistoriaClinicaNoHabilitadaError } from '../../domain/errors/historia-clinica-no-habilitada.error.js';
import { AutenticacionRequeridaError } from '../errors/autenticacion-requerida.error.js';
import { ConsultaOdontologica } from '../../domain/entities/consulta-odontologica.entity.js';
import { HistoriaClinicaId } from '../../domain/value-objects/historia-clinica-id.vo.js';
import { PacienteId } from '../../domain/value-objects/paciente-id.vo.js';
import { OdontologoId } from '../../domain/value-objects/odontologo-id.vo.js';
import { MotivoConsulta } from '../../domain/value-objects/motivo-consulta.vo.js';
import { SnapshotRiesgoClinico } from '../../domain/value-objects/snapshot-riesgo-clinico.vo.js';

describe('ListarConsultasPorHistoriaUseCase', () => {
  let useCase: ListarConsultasPorHistoriaUseCase;
  let mockRepository: { [K in keyof IConsultaOdontologicaRepositoryPort]: ReturnType<typeof vi.fn> };
  let mockHistoriaContext: { [K in keyof IHistoriaClinicaContextPort]: ReturnType<typeof vi.fn> };
  let mockOdontologoContext: { [K in keyof IOdontologoContextPort]: ReturnType<typeof vi.fn> };

  beforeEach(() => {
    mockRepository = {
      guardar: vi.fn(),
      actualizar: vi.fn(),
      buscarPorId: vi.fn(),
      buscarPorCitaId: vi.fn(),
      listarPorHistoriaClinica: vi.fn(),
      listarPorPacienteId: vi.fn(),
    };

    mockHistoriaContext = {
      obtenerResumenParaApertura: vi.fn().mockResolvedValue({
        existe: true,
        pacienteId: 'pac_123',
        estado: 'ACTIVA',
      }),
    };

    mockOdontologoContext = {
      obtenerOdontologoActual: vi.fn().mockResolvedValue({ odontologoId: 'od_001' }),
    };

    useCase = new ListarConsultasPorHistoriaUseCase(
      mockRepository as unknown as IConsultaOdontologicaRepositoryPort,
      mockHistoriaContext as unknown as IHistoriaClinicaContextPort,
      mockOdontologoContext as unknown as IOdontologoContextPort
    );
  });

  it('debe listar consultas paginadas normalizando límite y offset', async () => {
    const consulta = ConsultaOdontologica.abrir({
      historiaClinicaId: HistoriaClinicaId.crear('hc_123'),
      pacienteId: PacienteId.crear('pac_123'),
      odontologoId: OdontologoId.crear('od_001'),
      versionHistoriaReferenciada: 1,
      snapshotRiesgoClinico: SnapshotRiesgoClinico.vacio(),
      motivoConsulta: MotivoConsulta.crear('Revisión semestral'),
    });

    mockRepository.listarPorHistoriaClinica.mockResolvedValue({
      consultas: [consulta],
      total: 1,
    });

    const result = await useCase.execute({
      tokenAutenticacion: 'token_valido',
      historiaClinicaId: 'hc_123',
      limite: 15,
      offset: 0,
    });

    expect(result.consultas.length).toBe(1);
    expect(result.total).toBe(1);
    expect(result.limite).toBe(15);
    expect(result.offset).toBe(0);
  });

  it('debe rechazar si no se provee token de autenticación', async () => {
    await expect(
      useCase.execute({
        tokenAutenticacion: '',
        historiaClinicaId: 'hc_123',
      })
    ).rejects.toThrow(AutenticacionRequeridaError);
  });

  it('debe rechazar si el expediente no existe', async () => {
    mockHistoriaContext.obtenerResumenParaApertura.mockResolvedValue(null);

    await expect(
      useCase.execute({
        tokenAutenticacion: 'token_valido',
        historiaClinicaId: 'hc_no_existe',
      })
    ).rejects.toThrow(HistoriaClinicaNoHabilitadaError);
  });
});
