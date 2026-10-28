import { Inject, Injectable } from '@nestjs/common';
import {
  CATALOGO_SERVICIOS_PORT,
  type ICatalogoServiciosPort,
  type ServicioCatalogoDto,
} from '../ports/catalogo-servicios.port.js';
import { ServicioCatalogoNoEncontradoError } from '../errors/servicio-catalogo-no-encontrado.error.js';

/**
 * Caso de uso para consultar el catálogo de servicios odontológicos de MS1.
 * Permite listar servicios activos (con filtro opcional por especialidad)
 * y consultar el detalle de un servicio por su UUID canónico.
 */
@Injectable()
export class ConsultarCatalogoServiciosUseCase {
  constructor(
    @Inject(CATALOGO_SERVICIOS_PORT)
    private readonly catalogoServiciosPort: ICatalogoServiciosPort,
  ) {}

  async listar(especialidadId?: string): Promise<ServicioCatalogoDto[]> {
    return this.catalogoServiciosPort.listarServiciosActivos(especialidadId);
  }

  async obtenerPorId(servicioId: string): Promise<ServicioCatalogoDto> {
    const servicio = await this.catalogoServiciosPort.obtenerServicioPorId(servicioId);
    if (!servicio) {
      throw new ServicioCatalogoNoEncontradoError(servicioId);
    }
    return servicio;
  }
}

