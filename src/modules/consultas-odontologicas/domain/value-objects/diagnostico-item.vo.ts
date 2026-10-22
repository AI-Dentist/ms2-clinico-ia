import { TipoDiagnostico } from './tipo-diagnostico.enum.js';

export interface DiagnosticoItemProps {
  codigoCIE10?: string | null;
  descripcion: string;
  tipo: TipoDiagnostico;
}

/**
 * Value Object para un diagnóstico odontológico emitido durante la atención clínica.
 */
export class DiagnosticoItem {
  private readonly _codigoCIE10: string | null;
  private readonly _descripcion: string;
  private readonly _tipo: TipoDiagnostico;

  private constructor(props: DiagnosticoItemProps) {
    const desc = props.descripcion?.trim();
    if (!desc) {
      throw new Error('La descripción del diagnóstico no puede estar vacía.');
    }
    this._descripcion = desc;
    this._codigoCIE10 = props.codigoCIE10?.trim() || null;
    this._tipo = props.tipo;
  }

  static crear(props: DiagnosticoItemProps): DiagnosticoItem {
    return new DiagnosticoItem(props);
  }

  static reconstituir(props: DiagnosticoItemProps): DiagnosticoItem {
    return new DiagnosticoItem(props);
  }

  get codigoCIE10(): string | null {
    return this._codigoCIE10;
  }

  get descripcion(): string {
    return this._descripcion;
  }

  get tipo(): TipoDiagnostico {
    return this._tipo;
  }

  get esDefinitivo(): boolean {
    return this._tipo === TipoDiagnostico.DEFINITIVO;
  }

  get esPresuntivo(): boolean {
    return this._tipo === TipoDiagnostico.PRESUNTIVO;
  }
}
