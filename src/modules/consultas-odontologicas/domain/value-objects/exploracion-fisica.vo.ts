export interface ExploracionFisicaProps {
  inspeccionExtraoral?: string | null;
  inspeccionIntraoral: string;
  hallazgosDentales?: string | null;
}

/**
 * Value Object para la exploración física odontológica (extraoral, intraoral y hallazgos dentales).
 */
export class ExploracionFisica {
  private readonly _inspeccionExtraoral: string | null;
  private readonly _inspeccionIntraoral: string;
  private readonly _hallazgosDentales: string | null;

  private constructor(props: ExploracionFisicaProps) {
    this._inspeccionExtraoral = props.inspeccionExtraoral?.trim() || null;
    this._inspeccionIntraoral = props.inspeccionIntraoral?.trim() ?? '';
    this._hallazgosDentales = props.hallazgosDentales?.trim() || null;
  }

  static crear(props: ExploracionFisicaProps): ExploracionFisica {
    return new ExploracionFisica(props);
  }

  static reconstituir(props: ExploracionFisicaProps): ExploracionFisica {
    return new ExploracionFisica(props);
  }

  static vacia(): ExploracionFisica {
    return new ExploracionFisica({ inspeccionIntraoral: '' });
  }

  get inspeccionExtraoral(): string | null {
    return this._inspeccionExtraoral;
  }

  get inspeccionIntraoral(): string {
    return this._inspeccionIntraoral;
  }

  get hallazgosDentales(): string | null {
    return this._hallazgosDentales;
  }

  /**
   * Indica si la exploración cuenta con documentación intraoral mínima requerida para cerrar la atención.
   */
  get tieneInspeccionIntraoral(): boolean {
    return this._inspeccionIntraoral.length >= 5;
  }
}
