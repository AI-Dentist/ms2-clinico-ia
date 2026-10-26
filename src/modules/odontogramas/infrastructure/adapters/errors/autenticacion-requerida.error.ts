export class AutenticacionRequeridaError extends Error {
  constructor(mensaje = 'Token de autenticación requerido o inválido.') {
    super(mensaje);
    this.name = 'AutenticacionRequeridaError';
  }
}
