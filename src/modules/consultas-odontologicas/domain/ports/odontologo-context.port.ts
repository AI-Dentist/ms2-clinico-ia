/**
 * Datos del odontólogo identificado a partir del contexto autenticado.
 */
export interface OdontologoContexto {
  odontologoId: string;
  roles?: string[];
  email?: string;
  nombre?: string;
}

/**
 * Puerto SPI para resolver la identidad del profesional tratante a partir del token de autenticación.
 */
export interface IOdontologoContextPort {
  obtenerOdontologoActual(token: string): Promise<OdontologoContexto>;
}

/** Token de inyección de dependencias para IOdontologoContextPort. */
export const ODONTOLOGO_CONTEXT_PORT = Symbol('IOdontologoContextPort');
