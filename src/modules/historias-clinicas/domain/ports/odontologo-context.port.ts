/** Datos del odontólogo identificado en el contexto de la request. */
export interface OdontologoContexto {
  odontologoId: string;
}

/**
 * Puerto de salida para identificar al odontólogo autenticado.
 * En producción: valida el token contra MS1 (Spring Boot).
 * En desarrollo: usa MockOdontologoContextAdapter con un ID fijo desde .env.
 *
 * Nota: El mecanismo concreto de autenticación (JWT, sesión, etc.) está pendiente (DP-02).
 *
 * @throws AutenticacionRequeridaError si el token es inválido o ausente.
 */
export interface IOdontologoContextPort {
  obtenerOdontologoActual(token: string): Promise<OdontologoContexto>;
}

/** Token de inyección de dependencias para IOdontologoContextPort. */
export const ODONTOLOGO_CONTEXT_PORT = Symbol('IOdontologoContextPort');
