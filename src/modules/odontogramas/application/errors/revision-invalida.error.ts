export class RevisionInvalidaError extends Error {
  constructor(mensaje: string) {
    super(mensaje);
    this.name = 'RevisionInvalidaError';
  }

  static noEncontrada(revisionId: string): RevisionInvalidaError {
    return new RevisionInvalidaError(
      `La revisión histórica con ID '${revisionId}' no fue encontrada.`
    );
  }

  static noPerteneceAlOdontograma(revisionId: string, odontogramaEsperado: string, odontogramaReal: string): RevisionInvalidaError {
    return new RevisionInvalidaError(
      `La revisión '${revisionId}' pertenece al odontograma '${odontogramaReal}', no al solicitado '${odontogramaEsperado}'.`
    );
  }

  static referenciaInvalidaEnNuevaObservacion(): RevisionInvalidaError {
    return new RevisionInvalidaError(
      'Una revisión de tipo NUEVA_OBSERVACION no debe referenciar una revisión corregida. Use ENMIENDA_CORRECTIVA para rectificaciones históricas.'
    );
  }
}
