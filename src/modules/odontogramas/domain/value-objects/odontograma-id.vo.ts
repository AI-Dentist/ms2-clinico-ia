import { randomUUID } from 'node:crypto';

/**
 * Identificador canónico único del agregado Odontograma.
 * Formato: 'odo_<uuid_v4>'.
 */
export class OdontogramaId {
  private readonly _valor: string;

  private constructor(valor: string) {
    const v = valor?.trim();
    if (!v) {
      throw new Error('OdontogramaId no puede estar vacío.');
    }
    if (!v.startsWith('odo_') || v.length < 10) {
      throw new Error(`OdontogramaId '${v}' no cumple con el formato canónico 'odo_<uuid>'.`);
    }
    this._valor = v;
  }

  static generar(): OdontogramaId {
    return new OdontogramaId(`odo_${randomUUID()}`);
  }

  static reconstituir(valor: string): OdontogramaId {
    return new OdontogramaId(valor);
  }

  get valor(): string {
    return this._valor;
  }

  equals(otro: OdontogramaId): boolean {
    return this._valor === otro._valor;
  }

  toString(): string {
    return this._valor;
  }
}
