/**
 * Representación genérica de un evento de dominio clínico.
 */
export interface EventoDominioClinico {
  evento: string;
  eventoId: string;
  timestamp: Date;
  payload: Record<string, unknown>;
}

/**
 * Puerto SPI para la publicación futura de eventos de dominio clínico mediante RabbitMQ.
 * (Propuesta arquitectónica documentada para integración posterior; no implementa transporte en esta iteración).
 */
export interface IEventosClinicosPublisherPort {
  publicar(evento: EventoDominioClinico): Promise<void>;
}
