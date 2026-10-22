import { describe, it, expect, vi, beforeEach } from 'vitest';
import { ObtenerHistoriaPorPacienteUseCase } from './obtener-historia-por-paciente.use-case.js';
import type { IHistoriaClinicaRepository } from '../../domain/ports/historia-clinica.repository.port.js';
import { HistoriaClinica } from '../../domain/entities/historia-clinica.entity.js';
import { PacienteId } from '../../domain/value-objects/paciente-id.vo.js';
import { OdontologoId } from '../../domain/value-objects/odontologo-id.vo.js';
import { HistoriaClinicaNoEncontradaError } from '../../domain/errors/historia-clinica-no-encontrada.error.js';

type MockRepository = {
  [K in keyof IHistoriaClinicaRepository]: ReturnType<typeof vi.fn>;
};

describe('ObtenerHistoriaPorPacienteUseCase', () => {
  let useCase: ObtenerHistoriaPorPacienteUseCase;
  let mockRepository: MockRepository;

  beforeEach(() => {
    mockRepository = {
      guardar: vi.fn(),
      buscarPorId: vi.fn(),
      buscarPorPacienteId: vi.fn(),
      existePorPacienteId: vi.fn(),
      actualizar: vi.fn(),
    };

    useCase = new ObtenerHistoriaPorPacienteUseCase(
      mockRepository as unknown as IHistoriaClinicaRepository,
    );
  });

  it('debe retornar el DTO de la historia clínica si existe para el paciente', async () => {
    const historia = HistoriaClinica.crear(
      { pacienteId: PacienteId.crear('pac_paciente_123') },
      OdontologoId.crear('od_001'),
    );

    mockRepository.buscarPorPacienteId.mockResolvedValue(historia);

    const result = await useCase.execute({ pacienteId: 'pac_paciente_123' });

    expect(mockRepository.buscarPorPacienteId).toHaveBeenCalledWith(
      expect.objectContaining({ valor: 'pac_paciente_123' }),
    );
    expect(result.id).toBe(historia.id.valor);
    expect(result.pacienteId).toBe('pac_paciente_123');
  });

  it('debe lanzar HistoriaClinicaNoEncontradaError si el paciente no tiene expediente', async () => {
    mockRepository.buscarPorPacienteId.mockResolvedValue(null);

    await expect(useCase.execute({ pacienteId: 'pac_sin_historia' })).rejects.toThrow(
      HistoriaClinicaNoEncontradaError,
    );
  });

  it('debe lanzar Error si pacienteId es vacío', async () => {
    await expect(useCase.execute({ pacienteId: '   ' })).rejects.toThrow(
      'PacienteId no puede estar vacío.',
    );
  });
});
