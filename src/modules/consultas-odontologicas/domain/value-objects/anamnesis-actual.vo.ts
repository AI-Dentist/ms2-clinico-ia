export interface AnamnesisActualProps {
  descripcion: string;
  tiempoEvolucion?: string | null;
  escalaDolorEVA?: number | null;
}

/**
 * Value Object para la anamnesis actual de la dolencia o motivo del episodio odontológico.
 */
export class AnamnesisActual {
  private readonly _descripcion: string;
  private readonly _tiempoEvolucion: string | null;
  private readonly _escalaDolorEVA: number | null;

  private constructor(props: AnamnesisActualProps) {
    const desc = props.descripcion?.trim() ?? '';
    this._descripcion = desc;

    const tiempo = props.tiempoEvolucion?.trim() || null;
    this._tiempoEvolucion = tiempo;

    if (props.escalaDolorEVA !== undefined && props.escalaDolorEVA !== null) {
      if (!Number.isInteger(props.escalaDolorEVA) || props.escalaDolorEVA < 0 || props.escalaDolorEVA > 10) {
        throw new Error(
          `La escala de dolor EVA debe ser un entero entre 0 y 10 (recibido: ${props.escalaDolorEVA}).`
        );
      }
      this._escalaDolorEVA = props.escalaDolorEVA;
    } else {
      this._escalaDolorEVA = null;
    }
  }

  static crear(props: AnamnesisActualProps): AnamnesisActual {
    return new AnamnesisActual(props);
  }

  static reconstituir(props: AnamnesisActualProps): AnamnesisActual {
    return new AnamnesisActual(props);
  }

  static vacia(): AnamnesisActual {
    return new AnamnesisActual({ descripcion: '', tiempoEvolucion: null, escalaDolorEVA: null });
  }

  get descripcion(): string {
    return this._descripcion;
  }

  get tiempoEvolucion(): string | null {
    return this._tiempoEvolucion;
  }

  get escalaDolorEVA(): number | null {
    return this._escalaDolorEVA;
  }

  get tieneDolor(): boolean {
    return this._escalaDolorEVA !== null && this._escalaDolorEVA > 0;
  }
}
