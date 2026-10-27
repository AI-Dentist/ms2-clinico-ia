export interface OdontologoContexto {
  odontologoId: string;
}

export interface IOdontologoContextPort {
  obtenerOdontologoActual(token: string): Promise<OdontologoContexto>;
}

export const ODONTOLOGO_CONTEXT_PORT = Symbol('IOdontologoContextPort');
