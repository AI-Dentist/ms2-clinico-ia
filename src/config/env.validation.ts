export interface EnvironmentVariables {
  PORT: number;
  MONGODB_URI: string;
  PACIENTE_VALIDATOR_ADAPTER: 'mock' | 'graphql';
  CATALOGO_SERVICIOS_ADAPTER: 'mock' | 'graphql';
  MS1_GRAPHQL_URL: string;
  MS1_TIMEOUT_MS: number;
  MS1_BEARER_TOKEN?: string;
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
  };
}
