import { describe, it, expect, vi, beforeEach } from 'vitest';
import { BadRequestException } from '@nestjs/common';
import { GuardarEstudioClinicoUseCase } from './guardar-estudio-clinico.use-case.js';
import type { MongoEstudioClinicoRepository } from '../../infrastructure/persistence/mongo/repositories/mongo-estudio-clinico.repository.js';
import type { EstudioClinicoDto } from '../dtos/estudio-clinico.dto.js';

const mockDto: EstudioClinicoDto = {
  id: 'est_001',
  pacienteId: 'pac_001',
  consultaId: 'cons_001',
  odontologoId: 'od_001',
  analisisIa: {
    modeloNombre: 'liodon-ai/dental-panoramic-detector',
    version: '1.0.0-yolo11n',
    fechaInferencia: '2026-11-08T10:00:00.000Z',
    confianzaGlobal: 0.82,
    severidadMaxima: 'ALTA',
    hallazgos: [],
    observacionMedico: null,
  },
  imagenMimeType: 'image/jpeg',
  imagenNombreArchivo: 'rx.jpg',
  creadoEn: '2026-11-08T10:00:00.000Z',
};

describe('GuardarEstudioClinicoUseCase', () => {
  let useCase: GuardarEstudioClinicoUseCase;
  let mockRepo: Partial<MongoEstudioClinicoRepository>;

  beforeEach(() => {
    mockRepo = { crear: vi.fn().mockResolvedValue(mockDto) };
    useCase = new GuardarEstudioClinicoUseCase(mockRepo as MongoEstudioClinicoRepository);
  });

  it('should save and return a clinical study', async () => {
    const result = await useCase.execute({
      pacienteId: 'pac_001',
      consultaId: 'cons_001',
      odontologoId: 'od_001',
      analisisIa: mockDto.analisisIa,
    });

    expect(result).toEqual(mockDto);
    expect(mockRepo.crear).toHaveBeenCalledWith(
      expect.objectContaining({
        pacienteId: 'pac_001',
        odontologoId: 'od_001',
      }),
    );
  });

  it('should throw BadRequestException if pacienteId is empty', async () => {
    await expect(
      useCase.execute({
        pacienteId: '',
        consultaId: 'cons_001',
        odontologoId: 'od_001',
        analisisIa: mockDto.analisisIa,
      }),
    ).rejects.toThrow(BadRequestException);
  });

  it('should throw BadRequestException if odontologoId is empty (must come from JWT)', async () => {
    await expect(
      useCase.execute({
        pacienteId: 'pac_001',
        consultaId: 'cons_001',
        odontologoId: '',
        analisisIa: mockDto.analisisIa,
      }),
    ).rejects.toThrow(BadRequestException);
  });

  it('should throw BadRequestException if imagenBase64 exceeds 25 MB', async () => {
    // ~26 MB base64 string
    const bigBase64 = 'A'.repeat(Math.ceil(26 * 1024 * 1024 / 0.75));

    await expect(
      useCase.execute({
        pacienteId: 'pac_001',
        consultaId: 'cons_001',
        odontologoId: 'od_001',
        analisisIa: mockDto.analisisIa,
        imagenBase64: bigBase64,
      }),
    ).rejects.toThrow(BadRequestException);
  });
});
