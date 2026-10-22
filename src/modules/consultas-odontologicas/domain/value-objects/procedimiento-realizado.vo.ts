import type { PiezaDentalFDI } from './pieza-dental-fdi.vo.js';

export interface ProcedimientoRealizadoProps {
  codigo?: string | null;
  descripcion: string;
  piezaDental?: PiezaDentalFDI | null;
  observaciones?: string | null;
}

/**
 * Value Object para un procedimiento o intervención clínica realizada en sillón durante la consulta.
 */
export class ProcedimientoRealizado {
  private readonly _codigo: string | null;
  private readonly _descripcion: string;
  private readonly _piezaDental: PiezaDentalFDI | null;
  private readonly _observaciones: string | null;

  private constructor(props: ProcedimientoRealizadoProps) {
    const desc = props.descripcion?.trim();
    if (!desc) {
      throw new Error('La descripción del procedimiento no puede estar vacía.');
    }
    this._descripcion = desc;
    this._codigo = props.codigo?.trim() || null;
    this._piezaDental = props.piezaDental ?? null;
    this._observaciones = props.observaciones?.trim() || null;
  }

  static crear(props: ProcedimientoRealizadoProps): ProcedimientoRealizado {
    return new ProcedimientoRealizado(props);
  }

  static reconstituir(props: ProcedimientoRealizadoProps): ProcedimientoRealizado {
    return new ProcedimientoRealizado(props);
  }

  get codigo(): string | null {
    return this._codigo;
  }

  get descripcion(): string {
    return this._descripcion;
  }

  get piezaDental(): PiezaDentalFDI | null {
    return this._piezaDental;
  }

  get observaciones(): string | null {
    return this._observaciones;
  }

  get afectaPiezaDental(): boolean {
    return this._piezaDental !== null;
  }
}
