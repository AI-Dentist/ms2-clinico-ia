/**
 * Puerto para resolver el identificador canónico de un odontólogo en MS1 (ERP).
 *
 * En arquitecturas desacopladas donde Keycloak gestiona identidades de usuario
 * (`sub: UUID`) y MS1 gestiona registros maestros de profesionales clínicos
 * (`odontologoId: UUID`), este puerto permite obtener el UUID canónico del
 * odontólogo autenticado consultando MS1 a través de su operación GraphQL:
 *
 *   query ObtenerMiOdontologoId {
 *     obtenerMiOdontologoId
 *   }
 *
 * Invariantes de seguridad:
 * - Reenvía estrictamente el Bearer token del llamador actual (Caller Identity).
 * - NUNCA utiliza credenciales estáticas de servicio (MS1_BEARER_TOKEN) para auto-identidad.
 * - Sin estado global mutable ni caché de tokens entre peticiones concurrentes.
 * - Falla cerrado si el usuario no tiene un vínculo activo con un odontólogo en MS1.
 */
export interface ICanonicalDoctorResolver {
  /**
   * Resuelve el UUID canónico del odontólogo asociado al usuario autenticado.
   *
   * @param callerBearerToken Token JWT del llamador actual (sin o con prefijo 'Bearer ').
   * @returns UUID canónico del odontólogo en formato RFC 4122.
   * @throws AutenticacionRequeridaError si la resolución falla, el usuario no está vinculado o MS1 no responde.
   */
  resolverOdontologoId(callerBearerToken: string): Promise<string>;
}

export const CANONICAL_DOCTOR_RESOLVER = Symbol('ICanonicalDoctorResolver');
