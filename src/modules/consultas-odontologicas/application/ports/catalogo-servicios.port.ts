export interface EspecialidadCatalogoDto {
  id: string;
  codigo: string;
  nombre: string;
  descripcion?: string | null;
  activo: boolean;
}

/**
 * DTO que representa un servicio odontológico facturable del catálogo maestro de MS1.
 * 'precioBaseBs' se modela como string decimal exacto (ej: "150.00") para evitar imprecisiones
 * de coma flotante en operaciones de consulta o facturación.
 */
export interface ServicioCatalogoDto {
  id: string; // UUID canónico de MS1
  codigo: string;
  nombre: string;
  descripcion?: string | null;
  precioBaseBs: string; // String decimal exacto con dos decimales (ej. "150.00")
  activo: boolean;
  especialidad?: EspecialidadCatalogoDto | null;
}

/**
 * Puerto SPI para consultar el catálogo maestro de servicios odontológicos de MS1.
 */
export interface ICatalogoServiciosPort {
  /**
   * Obtiene la lista de servicios odontológicos activos desde el catálogo de MS1.
   * @param especialidadId UUID opcional para filtrar por especialidad.
   */
  listarServiciosActivos(especialidadId?: string): Promise<ServicioCatalogoDto[]>;

  /**
   * Obtiene el detalle de un servicio por su identificador UUID en MS1.
   * @param servicioId UUID del servicio en MS1.
   */
  obtenerServicioPorId(servicioId: string): Promise<ServicioCatalogoDto | null>;
}

/** Token de inyección de dependencias para ICatalogoServiciosPort. */
export const CATALOGO_SERVICIOS_PORT = Symbol('ICatalogoServiciosPort');

