import { SeveridadAlergia } from './severidad-alergia.enum.js';

export interface PropsAlergia {
  sustancia: string;
  tipoReaccion: string;
  severidad: SeveridadAlergia;
  notasAdicionales: string | null;
  /** Por defecto: fecha actual. Se preserva al reconstituir desde persistencia. */
  registradaEn?: Date;
}

/**
 * Value object que representa una alergia documentada en la historia clínica.
 *
 * Invariantes:
 * - 'sustancia' y 'tipoReaccion' son obligatorios y no pueden estar vacíos.
 * - La unicidad de sustancia (case-insensitive) se valida en la entidad HistoriaClinica,
 *   no aquí, porque el contexto de unicidad es el agregado, no el valor individual.
 */
export class Alergia {
  readonly sustancia: string;
  readonly tipoReaccion: string;
  readonly severidad: SeveridadAlergia;
  readonly notasAdicionales: string | null;
  readonly registradaEn: Date;

  private constructor(props: PropsAlergia) {
    const sustancia = props.sustancia?.trim();
    if (!sustancia) {
      throw new Error("Alergia: 'sustancia' es obligatoria y no puede estar vacía.");
    }
    const tipoReaccion = props.tipoReaccion?.trim();
    if (!tipoReaccion) {
      throw new Error("Alergia: 'tipoReaccion' es obligatorio y no puede estar vacío.");
    }

    this.sustancia = sustancia;
    this.tipoReaccion = tipoReaccion;
    this.severidad = props.severidad;
    this.notasAdicionales = props.notasAdicionales?.trim() ?? null;
    this.registradaEn = props.registradaEn ?? new Date();
  }

  static crear(props: PropsAlergia): Alergia {
    return new Alergia(props);
  }

  /**
   * Compara sustancias ignorando mayúsculas/minúsculas y espacios extremos.
   * Usado para verificar la invariante de unicidad en el agregado.
   */
  mismaSustanciaQue(otraSustancia: string): boolean {
    return this.sustancia.toLowerCase() === otraSustancia.trim().toLowerCase();
  }
}
