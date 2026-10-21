import { randomUUID } from 'node:crypto';

/**
 * Identificador único de la entidad HistoriaClinica.
 * Envuelve un UUID v4 con prefijo semántico 'hc_'.
 * Generado por el dominio; no delega su creación a MongoDB.
 */
export class HistoriaClinicaId {
  private readonly _valor: string;

  private constructor(valor: string) {
    const v = valor?.trim();
    if (!v) {
      throw new Error('HistoriaClinicaId no puede estar vacío.');
    }
    this._valor = v;
  }

  /** Genera un nuevo identificador único. */
  static generar(): HistoriaClinicaId {
    return new HistoriaClinicaId(`hc_${randomUUID()}`);
  }

  /** Reconstituye un identificador ya existente (desde persistencia). */
  static reconstituir(valor: string): HistoriaClinicaId {
    return new HistoriaClinicaId(valor);
  }

  get valor(): string {
    return this._valor;
  }

  equals(otro: HistoriaClinicaId): boolean {
    return this._valor === otro._valor;
  }

  toString(): string {
    return this._valor;
  }
}
