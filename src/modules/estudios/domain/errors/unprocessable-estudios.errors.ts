import { UnprocessableEntityException } from '@nestjs/common';

export class TransicionSolicitudInvalidaError extends UnprocessableEntityException {
  constructor(mensaje: string) {
    super(mensaje);
  }
}

export class ConsultaInvalidaParaEstudioError extends UnprocessableEntityException {
  constructor(detalle: string) {
    super(detalle);
  }
}
