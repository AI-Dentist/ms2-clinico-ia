/**
 * Error de aplicación lanzado cuando el token de autenticación es nulo, vacío
 * o no permite resolver el contexto del odontólogo.
 */
export class AutenticacionRequeridaError extends Error {
  readonly codigo = 'AUTENTICACION_REQUERIDA';

  constructor(mensaje = 'Se requiere autenticación válida para esta operación.') {
    super(mensaje);
    this.name = 'AutenticacionRequeridaError';
  }
}
