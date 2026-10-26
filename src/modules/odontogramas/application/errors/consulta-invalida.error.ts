export class ConsultaInvalidaError extends Error {
  constructor(mensaje: string) {
    super(mensaje);
    this.name = 'ConsultaInvalidaError';
  }

  static noEncontrada(consultaId: string): ConsultaInvalidaError {
    return new ConsultaInvalidaError(
      `La Consulta Odontológica con ID '${consultaId}' no existe.`
    );
  }

  static historiaDiferente(consultaId: string, esperada: string, recibida: string): ConsultaInvalidaError {
    return new ConsultaInvalidaError(
      `La Consulta '${consultaId}' pertenece a la Historia Clínica '${recibida}', pero la revisión se asoció a '${esperada}'.`
    );
  }

  static pacienteDiferente(consultaId: string, esperado: string, recibido: string): ConsultaInvalidaError {
    return new ConsultaInvalidaError(
      `La Consulta '${consultaId}' pertenece al paciente '${recibido}', pero el odontograma pertenece al paciente '${esperado}'.`
    );
  }

  static estadoNoPermitido(consultaId: string, estado: string): ConsultaInvalidaError {
    return new ConsultaInvalidaError(
      `La Consulta '${consultaId}' se encuentra en estado '${estado}'. Solo se pueden registrar revisiones clínicas durante consultas 'EN_CURSO'.`
    );
  }
}
