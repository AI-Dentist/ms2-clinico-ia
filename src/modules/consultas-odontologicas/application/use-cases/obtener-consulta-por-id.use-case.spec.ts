import { describe, it, expect, vi, beforeEach } from 'vitest';
import { ObtenerConsultaPorIdUseCase } from './obtener-consulta-por-id.use-case.js';
import type { IConsultaOdontologicaRepositoryPort } from '../../domain/ports/consulta-odontologica.repository.port.js';
import type { IOdontologoContextPort } from '../../domain/ports/odontologo-context.port.js';
import { ConsultaNoEncontradaError } from '../../domain/errors/consulta-no-encontrada.error.js';
import { AutenticacionRequeridaError } from '../errors/autenticacion-requerida.error.js';
import { ConsultaOdontologica } from '../../domain/entities/consulta-odontologica.entity.js';
import { HistoriaClinicaId } from '../../domain/value-objects/historia-clinica-id.vo.js';
import { PacienteId } from '../../domain/value-objects/paciente-id.vo.js';
import { OdontologoId } from '../../domain/value-objects/odontologo-id.vo.js';
import { MotivoConsulta } from '../../domain/value-objects/motivo-consulta.vo.js';
import { SnapshotRiesgoClinico } from '../../domain/value-objects/snapshot-riesgo-clinico.vo.js';

describe('ObtenerConsultaPorIdUseCase', () => {
  let useCase: ObtenerConsultaPorIdUseCase;
  let mockRepository: { [K in keyof IConsultaOdontologicaRepositoryPort]: ReturnType<typeof vi.fn> };
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

    mockOdontologoContext = {
      obtenerOdontologoActual: vi.fn().mockResolvedValue({ odontologoId: 'od_001' }),
    };

    useCase = new ObtenerConsultaPorIdUseCase(
      mockRepository as unknown as IConsultaOdontologicaRepositoryPort,
      mockOdontologoContext as unknown as IOdontologoContextPort
    );
  });

  it('debe obtener y mapear una consulta existente exitosamente', async () => {
    const consulta = ConsultaOdontologica.abrir({
      historiaClinicaId: HistoriaClinicaId.crear('hc_123'),
      pacienteId: PacienteId.crear('pac_123'),
      odontologoId: OdontologoId.crear('od_001'),
      versionHistoriaReferenciada: 1,
      snapshotRiesgoClinico: SnapshotRiesgoClinico.vacio(),
      motivoConsulta: MotivoConsulta.crear('Dolor molar persistente'),
    });
    mockRepository.buscarPorId.mockResolvedValue(consulta);

    const result = await useCase.execute({
      tokenAutenticacion: 'token_valido',
      consultaId: consulta.id.valor,
    });

    expect(result.id).toBe(consulta.id.valor);
    expect(result.motivoConsulta).toBe('Dolor molar persistente');
    expect(result.estado).toBe('EN_CURSO');
  });

  it('debe rechazar si no se provee token de autenticación', async () => {
    await expect(
      useCase.execute({
        tokenAutenticacion: '',
        consultaId: 'cons_123',
      })
    ).rejects.toThrow(AutenticacionRequeridaError);
  });

  it('debe lanzar ConsultaNoEncontradaError si la consulta no existe', async () => {
    mockRepository.buscarPorId.mockResolvedValue(null);

    await expect(
      useCase.execute({
        tokenAutenticacion: 'token_valido',
        consultaId: 'cons_inexistente_1234',
      })
    ).rejects.toThrow(ConsultaNoEncontradaError);
  });
});
