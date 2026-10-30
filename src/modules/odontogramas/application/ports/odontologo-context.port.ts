export interface OdontologoContexto {
  odontologoId: string;
  roles?: string[];
  email?: string;
  nombre?: string;
}

/**
 * Puerto SPI para resolver la identidad del odontólogo a partir del contexto autenticado en curso.
 */
export interface IOdontologoContextPort {
  obtenerOdontologoActual(token?: string): Promise<OdontologoContexto>;
}

export const ODONTOLOGO_CONTEXT_PORT = Symbol('IOdontologoContextPort');
