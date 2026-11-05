/**
 * Error lanzado cuando el servicio de identidad canónica externo (MS1 / ERP)
 * no está disponible temporalmente por timeout, fallo de red/conexión o error de servidor HTTP 5xx.
 *
 * Se traduce a HTTP 503 Service Unavailable para impedir que el frontend o shell
 * interprete la indisponibilidad como una revocación o expiración de credenciales (HTTP 401).
 */
export class ServicioIdentidadNoDisponibleError extends Error {
  readonly codigo = 'SERVICIO_IDENTIDAD_NO_DISPONIBLE';

  constructor(
    mensaje: string,
    public readonly causaOriginal?: unknown,
  ) {
    super(mensaje);
    this.name = 'ServicioIdentidadNoDisponibleError';
  }
}
