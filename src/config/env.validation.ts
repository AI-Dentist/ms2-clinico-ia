export interface EnvironmentVariables {
  PORT: number;
  MONGODB_URI: string;
  PACIENTE_VALIDATOR_ADAPTER: 'mock' | 'graphql';
  CATALOGO_SERVICIOS_ADAPTER: 'mock' | 'graphql';
  MS1_GRAPHQL_URL: string;
  MS1_TIMEOUT_MS: number;
  MS1_BEARER_TOKEN?: string;

  // RabbitMQ & Outbox Relay (Iteración 4)
  RABBITMQ_URL: string;
  RABBITMQ_EXCHANGE: string;
  RABBITMQ_ROUTING_KEY: string;
  RABBITMQ_PUBLISHER_ADAPTER: 'mock' | 'amqp';
  OUTBOX_RELAY_ENABLED: boolean;
  OUTBOX_POLL_INTERVAL_MS: number;
  OUTBOX_BATCH_SIZE: number;
  OUTBOX_MAX_ATTEMPTS: number;
}

export function validateEnv(config: Record<string, unknown>): EnvironmentVariables {
  const errors: string[] = [];

  const rawPort = config.PORT ?? 3001;
  const port = Number(rawPort);
  if (isNaN(port) || port <= 0 || port > 65535) {
    errors.push(`Variable 'PORT' inválida (${String(config.PORT)}). Debe ser un número entre 1 y 65535.`);
  }

  const mongoUri = config.MONGODB_URI;
  if (
    !mongoUri ||
    typeof mongoUri !== 'string' ||
    (!mongoUri.startsWith('mongodb://') && !mongoUri.startsWith('mongodb+srv://'))
  ) {
    errors.push(
      `Variable 'MONGODB_URI' obligatoria o con formato inválido. Debe comenzar con 'mongodb://' o 'mongodb+srv://'.`,
    );
  }

  const rawAdapter = typeof config.PACIENTE_VALIDATOR_ADAPTER === 'string'
    ? config.PACIENTE_VALIDATOR_ADAPTER.trim().toLowerCase()
    : 'mock';
  const adapter = rawAdapter;
  if (adapter !== 'mock' && adapter !== 'graphql') {
    errors.push(
      `Variable 'PACIENTE_VALIDATOR_ADAPTER' inválida ('${typeof config.PACIENTE_VALIDATOR_ADAPTER === 'string' ? config.PACIENTE_VALIDATOR_ADAPTER : 'no-string'}'). Valores admitidos: 'mock' | 'graphql'.`,
    );
  }

  const rawCatalogoAdapter = typeof config.CATALOGO_SERVICIOS_ADAPTER === 'string'
    ? config.CATALOGO_SERVICIOS_ADAPTER.trim().toLowerCase()
    : 'mock';
  const catalogoAdapter = rawCatalogoAdapter;
  if (catalogoAdapter !== 'mock' && catalogoAdapter !== 'graphql') {
    errors.push(
      `Variable 'CATALOGO_SERVICIOS_ADAPTER' inválida ('${typeof config.CATALOGO_SERVICIOS_ADAPTER === 'string' ? config.CATALOGO_SERVICIOS_ADAPTER : 'no-string'}'). Valores admitidos: 'mock' | 'graphql'.`,
    );
  }

  const rawGraphqlUrl = typeof config.MS1_GRAPHQL_URL === 'string' && config.MS1_GRAPHQL_URL.trim()
    ? config.MS1_GRAPHQL_URL.trim()
    : 'http://127.0.0.1:8081/graphql';
  const graphqlUrl = rawGraphqlUrl;
  if (!graphqlUrl.startsWith('http://') && !graphqlUrl.startsWith('https://')) {
    errors.push(
      `Variable 'MS1_GRAPHQL_URL' inválida ('${graphqlUrl}'). Debe comenzar con 'http://' o 'https://'.`,
    );
  }

  const rawTimeout = config.MS1_TIMEOUT_MS ?? 2000;
  const timeoutMs = Number(rawTimeout);
  if (isNaN(timeoutMs) || timeoutMs <= 0) {
    errors.push(
      `Variable 'MS1_TIMEOUT_MS' inválida ('${String(config.MS1_TIMEOUT_MS)}'). Debe ser un número positivo en milisegundos.`,
    );
  }

  const rawToken = config.MS1_BEARER_TOKEN;
  const bearerToken = typeof rawToken === 'string' && rawToken.trim() ? rawToken.trim() : undefined;

  // RabbitMQ & Outbox Relay (Iteración 4)
  const rawRabbitMqUrl =
    typeof config.RABBITMQ_URL === 'string' && config.RABBITMQ_URL.trim()
      ? config.RABBITMQ_URL.trim()
      : 'amqp://guest:guest@localhost:5672/';
  const rabbitMqUrl = rawRabbitMqUrl;

  const rawRabbitMqExchange =
    typeof config.RABBITMQ_EXCHANGE === 'string' && config.RABBITMQ_EXCHANGE.trim()
      ? config.RABBITMQ_EXCHANGE.trim()
      : 'dental.topic.exchange';
  const rabbitMqExchange = rawRabbitMqExchange;

  const rawRabbitMqRoutingKey =
    typeof config.RABBITMQ_ROUTING_KEY === 'string' && config.RABBITMQ_ROUTING_KEY.trim()
      ? config.RABBITMQ_ROUTING_KEY.trim()
      : 'clinica.consulta.finalizada';
  const rabbitMqRoutingKey = rawRabbitMqRoutingKey;

  const rawRabbitMqAdapter =
    typeof config.RABBITMQ_PUBLISHER_ADAPTER === 'string'
      ? config.RABBITMQ_PUBLISHER_ADAPTER.trim().toLowerCase()
      : 'mock';
  const rabbitMqAdapter = rawRabbitMqAdapter;
  if (rabbitMqAdapter !== 'mock' && rabbitMqAdapter !== 'amqp') {
    errors.push(
      `Variable 'RABBITMQ_PUBLISHER_ADAPTER' inválida ('${String(config.RABBITMQ_PUBLISHER_ADAPTER)}'). Valores admitidos: 'mock' | 'amqp'.`,
    );
  }

  const outboxRelayEnabled =
    config.OUTBOX_RELAY_ENABLED === true ||
    config.OUTBOX_RELAY_ENABLED === 'true' ||
    config.OUTBOX_RELAY_ENABLED === '1';

  const rawPollInterval = config.OUTBOX_POLL_INTERVAL_MS ?? 3000;
  const outboxPollIntervalMs = Number(rawPollInterval);
  if (isNaN(outboxPollIntervalMs) || outboxPollIntervalMs <= 0) {
    errors.push(
      `Variable 'OUTBOX_POLL_INTERVAL_MS' inválida ('${String(config.OUTBOX_POLL_INTERVAL_MS)}'). Debe ser un número positivo en milisegundos.`,
    );
  }

  const rawBatchSize = config.OUTBOX_BATCH_SIZE ?? 10;
  const outboxBatchSize = Number(rawBatchSize);
  if (isNaN(outboxBatchSize) || outboxBatchSize <= 0) {
    errors.push(
      `Variable 'OUTBOX_BATCH_SIZE' inválida ('${String(config.OUTBOX_BATCH_SIZE)}'). Debe ser un número entero positivo.`,
    );
  }

  const rawMaxAttempts = config.OUTBOX_MAX_ATTEMPTS ?? 5;
  const outboxMaxAttempts = Number(rawMaxAttempts);
  if (isNaN(outboxMaxAttempts) || outboxMaxAttempts <= 0) {
    errors.push(
      `Variable 'OUTBOX_MAX_ATTEMPTS' inválida ('${String(config.OUTBOX_MAX_ATTEMPTS)}'). Debe ser un número entero positivo.`,
    );
  }

  if (errors.length > 0) {
    throw new Error(`[ConfigValidationError] Configuración inválida:\n- ${errors.join('\n- ')}`);
  }

  return {
    PORT: port,
    MONGODB_URI: mongoUri as string,
    PACIENTE_VALIDATOR_ADAPTER: adapter as 'mock' | 'graphql',
    CATALOGO_SERVICIOS_ADAPTER: catalogoAdapter as 'mock' | 'graphql',
    MS1_GRAPHQL_URL: graphqlUrl,
    MS1_TIMEOUT_MS: timeoutMs,
    ...(bearerToken ? { MS1_BEARER_TOKEN: bearerToken } : {}),
    RABBITMQ_URL: rabbitMqUrl,
    RABBITMQ_EXCHANGE: rabbitMqExchange,
    RABBITMQ_ROUTING_KEY: rabbitMqRoutingKey,
    RABBITMQ_PUBLISHER_ADAPTER: rabbitMqAdapter as 'mock' | 'amqp',
    OUTBOX_RELAY_ENABLED: outboxRelayEnabled,
    OUTBOX_POLL_INTERVAL_MS: outboxPollIntervalMs,
    OUTBOX_BATCH_SIZE: outboxBatchSize,
    OUTBOX_MAX_ATTEMPTS: outboxMaxAttempts,
  };
}
