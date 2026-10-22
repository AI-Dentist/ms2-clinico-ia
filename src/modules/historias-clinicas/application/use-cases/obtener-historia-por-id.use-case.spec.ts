import { describe, it, expect, vi, beforeEach } from 'vitest';
import { ObtenerHistoriaPorIdUseCase } from './obtener-historia-por-id.use-case.js';
import type { IHistoriaClinicaRepository } from '../../domain/ports/historia-clinica.repository.port.js';
import { HistoriaClinica } from '../../domain/entities/historia-clinica.entity.js';
import { PacienteId } from '../../domain/value-objects/paciente-id.vo.js';
import { OdontologoId } from '../../domain/value-objects/odontologo-id.vo.js';
import { HistoriaClinicaNoEncontradaError } from '../../domain/errors/historia-clinica-no-encontrada.error.js';

type MockRepository = {
  [K in keyof IHistoriaClinicaRepository]: ReturnType<typeof vi.fn>;
};

describe('ObtenerHistoriaPorIdUseCase', () => {
  let useCase: ObtenerHistoriaPorIdUseCase;
  let mockRepository: MockRepository;

  beforeEach(() => {
    mockRepository = {
      guardar: vi.fn(),
      buscarPorId: vi.fn(),
      buscarPorPacienteId: vi.fn(),
      existePorPacienteId: vi.fn(),
      actualizar: vi.fn(),
    };

    useCase = new ObtenerHistoriaPorIdUseCase(
      mockRepository as unknown as IHistoriaClinicaRepository,
    );
  });

  it('debe retornar el DTO de la historia clínica si existe en el repositorio', async () => {
    const historia = HistoriaClinica.crear(
      { pacienteId: PacienteId.crear('pac_001') },
      OdontologoId.crear('od_001'),
    );

    mockRepository.buscarPorId.mockResolvedValue(historia);

    const result = await useCase.execute({ id: historia.id.valor });

    expect(mockRepository.buscarPorId).toHaveBeenCalledWith(
      expect.objectContaining({ valor: historia.id.valor }),
    );
    expect(result.id).toBe(historia.id.valor);
    expect(result.pacienteId).toBe('pac_001');
    expect(result.odontologoResponsableId).toBe('od_001');
  });

  it('debe lanzar HistoriaClinicaNoEncontradaError si el repositorio retorna null', async () => {
    mockRepository.buscarPorId.mockResolvedValue(null);

    await expect(useCase.execute({ id: 'hc_no_existe' })).rejects.toThrow(
      HistoriaClinicaNoEncontradaError,
    );
  });

  it('debe lanzar Error si el id provisto es vacío', async () => {
    await expect(useCase.execute({ id: '' })).rejects.toThrow(
      'HistoriaClinicaId no puede estar vacío.',
    );
  });
});
