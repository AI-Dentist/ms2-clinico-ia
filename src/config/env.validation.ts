export interface EnvironmentVariables {
  PORT: number;
  MONGODB_URI: string;
}

export function validateEnv(config: Record<string, unknown>): EnvironmentVariables {
  const errors: string[] = [];

  const rawPort = config.PORT ?? 3001;
  const port = Number(rawPort);
  if (isNaN(port) || port <= 0 || port > 65535) {
    errors.push(`Variable 'PORT' inválida (${config.PORT}). Debe ser un número entre 1 y 65535.`);
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

  if (errors.length > 0) {
    throw new Error(`[ConfigValidationError] Configuración inválida:\n- ${errors.join('\n- ')}`);
  }

  return {
    PORT: port,
    MONGODB_URI: mongoUri as string,
  };
}
