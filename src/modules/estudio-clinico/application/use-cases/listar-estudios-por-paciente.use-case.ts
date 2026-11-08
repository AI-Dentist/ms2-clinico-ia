import { Injectable } from '@nestjs/common';
import { MongoEstudioClinicoRepository } from '../../infrastructure/persistence/mongo/repositories/mongo-estudio-clinico.repository.js';
import type { EstudioClinicoDto } from '../dtos/estudio-clinico.dto.js';

@Injectable()
export class ListarEstudiosPorPacienteUseCase {
  constructor(private readonly repo: MongoEstudioClinicoRepository) {}

  async execute(pacienteId: string): Promise<EstudioClinicoDto[]> {
    return this.repo.listarPorPaciente(pacienteId);
  }
}
