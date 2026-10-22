/**
 * Identificador opcional de la cita agendada en MS3 (Wendy).
 * Si la consulta es espontánea o de guardia, citaId es nulo.
 */
export class CitaId {
  private readonly _valor: string;

  private constructor(valor: string) {
    const v = valor?.trim();
    if (!v) {
      throw new Error('CitaId no puede estar vacío si se proporciona.');
    }
    this._valor = v;
  }

  static crear(valor: string): CitaId {
    return new CitaId(valor);
  }

  static reconstituir(valor: string): CitaId {
    return new CitaId(valor);
  }

  get valor(): string {
    return this._valor;
  }

  equals(otro: CitaId): boolean {
    return this._valor === otro._valor;
  }

  toString(): string {
    return this._valor;
  }
}
