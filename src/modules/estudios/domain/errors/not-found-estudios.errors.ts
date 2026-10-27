import { NotFoundException } from '@nestjs/common';

export class LaboratorioNoEncontradoError extends NotFoundException {
  constructor(id: string) {
    super(`Laboratorio con identificador '${id}' no encontrado.`);
  }
}

export class TipoEstudioNoEncontradoError extends NotFoundException {
  constructor(id: string) {
    super(`Tipo de estudio con identificador '${id}' no encontrado.`);
  }
}

export class SolicitudEstudioNoEncontradaError extends NotFoundException {
  constructor(id: string) {
    super(`Solicitud de estudio con identificador '${id}' no encontrada.`);
  }
}
