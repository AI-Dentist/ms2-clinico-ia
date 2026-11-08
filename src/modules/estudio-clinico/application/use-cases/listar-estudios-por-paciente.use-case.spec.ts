import { describe, it, expect, vi, beforeEach } from 'vitest';
import { ListarEstudiosPorPacienteUseCase } from './listar-estudios-por-paciente.use-case.js';
import type { MongoEstudioClinicoRepository } from '../../infrastructure/persistence/mongo/repositories/mongo-estudio-clinico.repository.js';
import type { EstudioClinicoDto } from '../dtos/estudio-clinico.dto.js';

describe('ListarEstudiosPorPacienteUseCase', () => {
  let useCase: ListarEstudiosPorPacienteUseCase;
  let mockRepo: Partial<MongoEstudioClinicoRepository>;

  const mockList: EstudioClinicoDto[] = [
    {
      id: 'est_001',
      pacienteId: 'pac_001',
      consultaId: 'cons_001',
      odontologoId: 'od_001',
      analisisIa: {
        modeloNombre: 'liodon-ai/dental-panoramic-detector',
        version: '1.0.0-yolo11n',
        fechaInferencia: '2026-11-08T10:00:00.000Z',
        confianzaGlobal: 0.72,
        severidadMaxima: 'MEDIA',
        hallazgos: [],
        observacionMedico: null,
      },
      imagenMimeType: 'image/png',
      imagenNombreArchivo: 'rx.png',
      creadoEn: '2026-11-08T10:00:00.000Z',
    },
  ];

  beforeEach(() => {
    mockRepo = { listarPorPaciente: vi.fn().mockResolvedValue(mockList) };
    useCase = new ListarEstudiosPorPacienteUseCase(mockRepo as MongoEstudioClinicoRepository);
  });

  it('should return the list from the repository', async () => {
    const result = await useCase.execute('pac_001');
    expect(result).toEqual(mockList);
    expect(mockRepo.listarPorPaciente).toHaveBeenCalledWith('pac_001');
  });

  it('should return an empty array when no studies exist', async () => {
    (mockRepo.listarPorPaciente as ReturnType<typeof vi.fn>).mockResolvedValueOnce([]);
    const result = await useCase.execute('pac_unknown');
    expect(result).toEqual([]);
  });

  it('should not include imagenBase64 in returned DTOs (excluded by repository)', async () => {
    const result = await useCase.execute('pac_001');
    for (const dto of result) {
      expect(dto).not.toHaveProperty('imagenBase64');
    }
  });
});
