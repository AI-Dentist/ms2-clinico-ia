/**
 * Identificador externo del odontólogo / profesional de salud.
 * Opaco: puede ser UUID, número u otro formato definido por MS1 (Spring Boot).
 * El dominio no valida la autenticación; eso lo hace IOdontologoContextPort.
 */
export class OdontologoId {
  private readonly _valor: string;

  private constructor(valor: string) {
    const v = valor?.trim();
    if (!v) {
      throw new Error('OdontologoId no puede estar vacío.');
    }
    this._valor = v;
  }

  static crear(valor: string): OdontologoId {
    return new OdontologoId(valor);
  }

  get valor(): string {
    return this._valor;
  }

  equals(otro: OdontologoId): boolean {
    return this._valor === otro._valor;
  }

  toString(): string {
    return this._valor;
  }
}
