import type { ConsultaOdontologica } from '../../domain/entities/consulta-odontologica.entity.js';
import type {
  ConsultaFinalizadaMensajePlanoDto,
  ServicioRealizadoCobroPlanoDto,
} from '../dtos/consulta-finalizada-mensaje-plano.dto.js';

/**
 * Ensamblador / Mapper de integración para transformar una ConsultaOdontologica completada
 * en el mensaje JSON plano requerido por MS1 para generar órdenes de cobro.
 *
 * Mantiene la conversión fuera del dominio clínico de la entidad.
 * Convierte el identificador 'cons_<uuid>' a UUID canónico puro exclusivamente en esta capa.
 * Transforma piezas dentales numéricas FDI a formato String requerido por el contrato de MS1.
 */
export class ConsultaOrdenCobroMs1Mapper {
  /**
   * Construye el mensaje plano para MS1.
   * Si la consulta no tiene servicios facturables (ej: control o sin cobro), retorna null.
   */
  static toMensajePlano(
    consulta: ConsultaOdontologica,
  ): ConsultaFinalizadaMensajePlanoDto | null {
    if (!consulta.tieneServiciosFacturables) {
      return null;
    }

    const serviciosRealizados: ServicioRealizadoCobroPlanoDto[] =
      consulta.serviciosFacturables.map((item) => ({
        servicioId: item.servicioId,
        cantidad: item.cantidad,
        precioUnitarioBs: item.precioUnitarioBs,
        piezaDental:
          item.piezaDental !== null && item.piezaDental !== undefined
            ? String(item.piezaDental)
            : null,
      }));

    return {
      consultaId: consulta.id.toCanonicalUuid(),
      pacienteId: consulta.pacienteId.valor,
      odontologoId: consulta.odontologoId ? consulta.odontologoId.valor : null,
      serviciosRealizados,
      observacionesCobro: consulta.observacionesCobro ?? null,
    };
  }
}

