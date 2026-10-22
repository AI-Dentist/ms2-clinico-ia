/**
 * Identificador del paciente atendido, originado en MS1.
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

  static reconstituir(valor: string): PacienteId {
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
