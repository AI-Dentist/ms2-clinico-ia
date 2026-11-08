import { BadRequestException, Injectable } from '@nestjs/common';
import { MongoEstudioClinicoRepository } from '../../infrastructure/persistence/mongo/repositories/mongo-estudio-clinico.repository.js';
import type { CrearEstudioClinicoCommand, EstudioClinicoDto } from '../dtos/estudio-clinico.dto.js';

const MAX_IMAGE_BYTES = 25 * 1024 * 1024;

@Injectable()
export class GuardarEstudioClinicoUseCase {
  constructor(private readonly repo: MongoEstudioClinicoRepository) {}

  async execute(cmd: CrearEstudioClinicoCommand): Promise<EstudioClinicoDto> {
    if (!cmd.pacienteId?.trim()) {
      throw new BadRequestException('pacienteId es requerido.');
    }
    if (!cmd.consultaId?.trim()) {
      throw new BadRequestException('consultaId es requerido.');
    }
    if (!cmd.odontologoId?.trim()) {
      throw new BadRequestException('odontologoId es requerido (extraído del JWT).');
    }

    if (cmd.imagenBase64) {
      const approxBytes = Math.round(cmd.imagenBase64.length * 0.75);
      if (approxBytes > MAX_IMAGE_BYTES) {
        throw new BadRequestException(
          `La imagen excede el tamaño máximo permitido de ${MAX_IMAGE_BYTES / 1024 / 1024} MB.`,
        );
      }
    }

    return this.repo.crear(cmd);
  }
}
