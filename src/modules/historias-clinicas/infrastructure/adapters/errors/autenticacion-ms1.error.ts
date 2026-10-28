/**
 * Error lanzado cuando la consulta a MS1 es rechazada por problemas
 * de autenticación (HTTP 401) o autorización/roles insuficientes (HTTP 403).
 */
export class AutenticacionMs1Error extends Error {
  readonly codigo = 'MS1_AUTENTICACION_FALLIDA';

  constructor(
    public readonly statusHttp: number,
    mensaje = 'Fallo de autenticación o autorización al consultar MS1.',
  ) {
    super(`[HTTP ${statusHttp}] ${mensaje}`);
    this.name = 'AutenticacionMs1Error';
  }
}

