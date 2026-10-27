import { ConflictException } from '@nestjs/common';

export class LaboratorioDuplicadoError extends ConflictException {
  constructor(nombre: string) {
    super(`Ya existe un laboratorio registrado con el nombre '${nombre}'.`);
  }
}

export class TipoEstudioDuplicadoError extends ConflictException {
  constructor(campo: 'codigo' | 'nombre', valor: string) {
    super(`Ya existe un tipo de estudio registrado con el ${campo} '${valor}'.`);
  }
}

export class ResultadoYaRegistradoError extends ConflictException {
  constructor(solicitudId: string) {
    super(`La solicitud '${solicitudId}' ya cuenta con un resultado clínico registrado. Prohibida la sobrescritura silenciosa.`);
  }
}
