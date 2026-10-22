/**
 * Referencia lógica a la Historia Clínica titular de la atención.
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

  static crear(valor: string): HistoriaClinicaId {
    return new HistoriaClinicaId(valor);
  }

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
