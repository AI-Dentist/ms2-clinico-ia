/**
 * Value Object para el motivo principal de la consulta.
 * Representa la queja o razón manifestada por el paciente (5 a 500 caracteres).
 */
export class MotivoConsulta {
  private readonly _valor: string;

  private constructor(valor: string) {
    const v = valor?.trim();
    if (!v) {
      throw new Error('El motivo de consulta no puede estar vacío.');
    }
    if (v.length < 5) {
      throw new Error(`El motivo de consulta debe tener al menos 5 caracteres (longitud actual: ${v.length}).`);
    }
    if (v.length > 500) {
      throw new Error(`El motivo de consulta no puede exceder 500 caracteres (longitud actual: ${v.length}).`);
    }
    this._valor = v;
  }

  static crear(valor: string): MotivoConsulta {
    return new MotivoConsulta(valor);
  }

  static reconstituir(valor: string): MotivoConsulta {
    return new MotivoConsulta(valor);
  }

  get valor(): string {
    return this._valor;
  }

  equals(otro: MotivoConsulta): boolean {
    return this._valor === otro._valor;
  }

  toString(): string {
    return this._valor;
  }
}
