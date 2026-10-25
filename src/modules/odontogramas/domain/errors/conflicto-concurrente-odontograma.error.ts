/**
 * Se lanza cuando ocurre una colisión de concurrencia optimista al actualizar un odontograma (INV-ODO-06).
 */
export class ConflictoConcurrenteOdontogramaError extends Error {
  readonly codigo = 'CONFLICTO_CONCURRENTE_ODONTOGRAMA';
  readonly odontogramaId: string;
  readonly versionEsperada: number;

  constructor(odontogramaId: string, versionEsperada: number) {
    super(
      `Conflicto de concurrencia en el odontograma '${odontogramaId}'. La versión esperada (${versionEsperada}) no coincide con la versión actual persistida. Otro operador o proceso modificó el odontograma simultáneamente.`
    );
    this.name = 'ConflictoConcurrenteOdontogramaError';
    this.odontogramaId = odontogramaId;
    this.versionEsperada = versionEsperada;
  }
}
