/**
 * Identificador externo del paciente.
 * Opaco: puede ser UUID, número u otro formato definido por MS1 (Spring Boot).
 * El dominio no valida la existencia del paciente; eso lo hace IPacienteValidatorPort.
 */
export class PacienteId {
  private readonly _valor: string;

  private constructor(valor: string) {
    const v = valor?.trim();
    if (!v) {
      throw new Error('PacienteId no puede estar vacío.');
    }
    this._valor = v;
  }

  static crear(valor: string): PacienteId {
    return new PacienteId(valor);
  }

  get valor(): string {
    return this._valor;
  }

  equals(otro: PacienteId): boolean {
    return this._valor === otro._valor;
  }

  toString(): string {
    return this._valor;
  }
}
