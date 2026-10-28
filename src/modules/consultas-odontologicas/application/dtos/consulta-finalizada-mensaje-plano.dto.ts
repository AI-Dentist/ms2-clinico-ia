/**
 * Contrato de mensaje plano para integración con MS1 (ERP)
 * al finalizar una consulta odontológica con orden de cobro.
 *
 * REGLAS DE CONTRATO MS1:
 * - Mensaje JSON plano, sin envoltorio 'payload' anidado.
 * - consultaId: UUID canónico RFC 4122 sin prefijo 'cons_'.
 * - pacienteId: UUID del paciente en MS1.
 * - odontologoId: UUID del odontólogo en MS1 o null.
 * - serviciosRealizados: Mínimo 1 elemento cuando requiere orden de cobro.
 *   - servicioId: UUID del servicio activo en MS1.
 *   - cantidad: Entero >= 1.
 *   - precioUnitarioBs: String decimal exacto con 2 decimales (ej: '150.00').
 *   - piezaDental: String representativo de la pieza FDI ('11', '16', etc.) o null.
 * - observacionesCobro: String opcional o null.
 *
 * NOTA DE ARQUITECTURA:
 * Este contrato está preparado para ser publicado a RabbitMQ mediante el patrón
 * Transactional Outbox en una iteración posterior, garantizando entrega confiable
 * desacoplada de la transacción del agregado clínico.
 */
export interface ServicioRealizadoCobroPlanoDto {
  servicioId: string;
  cantidad: number;
  precioUnitarioBs: string;
  piezaDental?: string | null;
}

export interface ConsultaFinalizadaMensajePlanoDto {
  consultaId: string;
  pacienteId: string;
  odontologoId: string | null;
  serviciosRealizados: ServicioRealizadoCobroPlanoDto[];
  observacionesCobro?: string | null;
}

