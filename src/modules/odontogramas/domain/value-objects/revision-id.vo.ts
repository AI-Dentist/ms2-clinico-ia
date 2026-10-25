import { randomUUID } from 'node:crypto';

/**
 * Identificador canónico único de una revisión o snapshot del Odontograma.
 * Formato: 'rev_odo_<uuid_v4>'.
 */
export class RevisionId {
  private readonly _valor: string;

  private constructor(valor: string) {
    const v = valor?.trim();
    if (!v) {
      throw new Error('RevisionId no puede estar vacío.');
    }
    if (!v.startsWith('rev_odo_') || v.length < 14) {
      throw new Error(`RevisionId '${v}' no cumple con el formato canónico 'rev_odo_<uuid>'.`);
    }
    this._valor = v;
  }

  static generar(): RevisionId {
    return new RevisionId(`rev_odo_${randomUUID()}`);
  }

  static reconstituir(valor: string): RevisionId {
    return new RevisionId(valor);
  }

  get valor(): string {
    return this._valor;
  }

  equals(otro: RevisionId): boolean {
    return this._valor === otro._valor;
  }

  toString(): string {
    return this._valor;
  }
}
