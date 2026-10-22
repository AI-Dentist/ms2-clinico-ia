import { randomUUID } from 'node:crypto';

/**
 * Identificador único canónico de una Consulta Odontológica.
 * Sigue el patrón 'cons_<uuid_v4>' (INV-CONS-01).
 */
export class ConsultaId {
  private readonly _valor: string;

  private constructor(valor: string) {
    const v = valor?.trim();
    if (!v) {
      throw new Error('ConsultaId no puede estar vacío.');
    }
    if (!v.startsWith('cons_') || v.length < 10) {
      throw new Error(`ConsultaId '${v}' no cumple con el formato canónico 'cons_<uuid>'.`);
    }
    this._valor = v;
  }

  /** Genera un nuevo ConsultaId con prefijo 'cons_' y UUID v4. */
  static generar(): ConsultaId {
    return new ConsultaId(`cons_${randomUUID()}`);
  }

  /** Reconstituye un ConsultaId persistido o recibido. */
  static reconstituir(valor: string): ConsultaId {
    return new ConsultaId(valor);
  }

  get valor(): string {
    return this._valor;
  }

  equals(otro: ConsultaId): boolean {
    return this._valor === otro._valor;
  }

  toString(): string {
    return this._valor;
  }
}
