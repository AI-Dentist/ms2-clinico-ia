/**
 * Se lanza cuando ocurre una colisión de concurrencia optimista al actualizar una consulta (INV-CONS-09).
 */
export class ConflictoConcurrenteConsultaError extends Error {
  readonly codigo = 'CONFLICTO_CONCURRENTE_CONSULTA';
  readonly consultaId: string;
  readonly versionEsperada: number;

  constructor(consultaId: string, versionEsperada: number) {
    super(
      `Conflicto de concurrencia en la consulta '${consultaId}'. La versión esperada (${versionEsperada}) no coincide con la versión persistida. Otro operador o proceso modificó la consulta simultáneamente.`
    );
    this.name = 'ConflictoConcurrenteConsultaError';
    this.consultaId = consultaId;
    this.versionEsperada = versionEsperada;
  }
}
