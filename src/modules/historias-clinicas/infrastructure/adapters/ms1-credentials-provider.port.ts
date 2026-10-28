/**
 * Puerto para obtener credenciales o token Bearer para llamadas
 * de servicio a servicio de MS2 hacia MS1.
 */
export interface IMs1CredentialsProvider {
  /**
   * Obtiene el token de autenticación Bearer para las llamadas hacia MS1.
   * Si no hay credenciales configuradas o disponibles, retorna null.
   */
  getBearerToken(): Promise<string | null>;
}

/** Token de inyección de dependencias para IMs1CredentialsProvider. */
export const MS1_CREDENTIALS_PROVIDER = Symbol('IMs1CredentialsProvider');

