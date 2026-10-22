/**
 * Error de aplicación lanzado cuando el token de autenticación es ausente,
 * inválido o no puede ser resuelto por el contexto de odontólogo.
 */
export class AutenticacionRequeridaError extends Error {
  readonly codigo = 'AUTENTICACION_REQUERIDA';

  constructor(mensaje = 'Se requiere autenticación válida para esta operación.') {
    super(mensaje);
    this.name = 'AutenticacionRequeridaError';
  }
}
