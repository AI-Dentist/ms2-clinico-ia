export interface OdontologoContexto {
  odontologoId: string;
  roles?: string[];
  email?: string;
  nombre?: string;
}

export interface IOdontologoContextPort {
  obtenerOdontologoActual(token: string): Promise<OdontologoContexto>;
}

export const ODONTOLOGO_CONTEXT_PORT = Symbol('IOdontologoContextPort');
