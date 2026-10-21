/**
 * Se lanza cuando el repositorio detecta que la versión enviada por el cliente
 * no coincide con la versión actual del documento en MongoDB.
 * El cliente debe recargar el expediente y reintentar.
 */
export class ConflictoConcurrenteError extends Error {
  readonly codigo = 'CONFLICTO_CONCURRENTE';
  /** Versión actual en la base de datos para que el cliente pueda reintentar. */
  readonly versionActual: number;

  constructor(versionActual: number) {
    super(
      'La historia clínica fue modificada por otro proceso. ' +
        'Recargue el expediente y vuelva a intentarlo.',
    );
    this.name = 'ConflictoConcurrenteError';
    this.versionActual = versionActual;
  }
}
