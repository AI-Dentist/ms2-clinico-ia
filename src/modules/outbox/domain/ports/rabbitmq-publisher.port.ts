export const RABBITMQ_PUBLISHER_PORT = Symbol('RABBITMQ_PUBLISHER_PORT');

export interface OpcionesPublicacion {
  timeoutMs?: number;
  messageId?: string;
  correlationId?: string;
}

/**
 * Puerto para la publicación de mensajes hacia RabbitMQ utilizando Publisher Confirms.
 */
export interface IRabbitMqPublisherPort {
  /**
   * Publica un mensaje garantizando confirmación explícita (ACK) del broker.
   * Lanza un error si el broker responde NACK, si el mensaje es devuelto como inenrutable
   * o si se supera el timeout de espera de confirmación.
   */
  publicar(
    exchange: string,
    routingKey: string,
    payload: Record<string, unknown>,
    opciones?: OpcionesPublicacion,
  ): Promise<void>;
}

