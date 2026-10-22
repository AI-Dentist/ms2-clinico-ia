export interface EvolucionSOAPProps {
  subjetivo?: string | null;
  objetivo?: string | null;
  analisis?: string | null;
  plan?: string | null;
}

/**
 * Value Object para la nota de evolución clínica bajo estructura SOAP (Subjetivo, Objetivo, Análisis, Plan).
 * Estructura complementaria y opcional en el MVP.
 */
export class EvolucionSOAP {
  private readonly _subjetivo: string | null;
  private readonly _objetivo: string | null;
  private readonly _analisis: string | null;
  private readonly _plan: string | null;

  private constructor(props: EvolucionSOAPProps) {
    this._subjetivo = props.subjetivo?.trim() || null;
    this._objetivo = props.objetivo?.trim() || null;
    this._analisis = props.analisis?.trim() || null;
    this._plan = props.plan?.trim() || null;
  }

  static crear(props: EvolucionSOAPProps): EvolucionSOAP {
    return new EvolucionSOAP(props);
  }

  static reconstituir(props: EvolucionSOAPProps): EvolucionSOAP {
    return new EvolucionSOAP(props);
  }

  static vacia(): EvolucionSOAP {
    return new EvolucionSOAP({});
  }

  get subjetivo(): string | null {
    return this._subjetivo;
  }

  get objetivo(): string | null {
    return this._objetivo;
  }

  get analisis(): string | null {
    return this._analisis;
  }

  get plan(): string | null {
    return this._plan;
  }

  get tieneContenido(): boolean {
    return !!(this._subjetivo || this._objetivo || this._analisis || this._plan);
  }
}
