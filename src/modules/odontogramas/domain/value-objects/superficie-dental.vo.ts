import { TipoSuperficie } from './tipo-superficie.enum.js';
import { CondicionSuperficie } from './condicion-superficie.enum.js';

export interface SuperficieDentalProps {
  superficie: TipoSuperficie;
  condicion: CondicionSuperficie;
  evaluada: boolean;
}

/**
 * Value Object inmutable que representa el estado de una superficie dental individual.
 */
export class SuperficieDental {
  private readonly _superficie: TipoSuperficie;
  private readonly _condicion: CondicionSuperficie;
  private readonly _evaluada: boolean;

  private constructor(props: SuperficieDentalProps) {
    if (!props.superficie) {
      throw new Error('El tipo de superficie es obligatorio.');
    }
    if (!props.condicion) {
      throw new Error('La condición de superficie es obligatoria.');
    }

    this._superficie = props.superficie;
    this._condicion = props.condicion;
    // Si la condición es NO_EVALUADA, evaluada no puede ser true a menos que se defina explícitamente
    this._evaluada = props.condicion === CondicionSuperficie.NO_EVALUADA ? false : Boolean(props.evaluada);
    Object.freeze(this);
  }

  /**
   * Crea una superficie en estado inicial no evaluado.
   */
  static crearNoEvaluada(superficie: TipoSuperficie): SuperficieDental {
    return new SuperficieDental({
      superficie,
      condicion: CondicionSuperficie.NO_EVALUADA,
      evaluada: false,
    });
  }

  /**
   * Crea una superficie examinada clínicamente con una condición explícita.
   */
  static crear(superficie: TipoSuperficie, condicion: CondicionSuperficie): SuperficieDental {
    return new SuperficieDental({
      superficie,
      condicion,
      evaluada: condicion !== CondicionSuperficie.NO_EVALUADA,
    });
  }

  static reconstituir(props: SuperficieDentalProps): SuperficieDental {
    return new SuperficieDental(props);
  }

  get superficie(): TipoSuperficie {
    return this._superficie;
  }

  get condicion(): CondicionSuperficie {
    return this._condicion;
  }

  get evaluada(): boolean {
    return this._evaluada;
  }

  get tienePatologia(): boolean {
    return this._condicion === CondicionSuperficie.CARIES || this._condicion === CondicionSuperficie.FRACTURA;
  }

  get tieneRestauracion(): boolean {
    return (
      this._condicion === CondicionSuperficie.OBTURACION_RESINA ||
      this._condicion === CondicionSuperficie.OBTURACION_AMALGAMA ||
      this._condicion === CondicionSuperficie.SELLANTE
    );
  }

  equals(otra: SuperficieDental): boolean {
    return (
      this._superficie === otra._superficie &&
      this._condicion === otra._condicion &&
      this._evaluada === otra._evaluada
    );
  }

  toObject(): SuperficieDentalProps {
    return {
      superficie: this._superficie,
      condicion: this._condicion,
      evaluada: this._evaluada,
    };
  }
}
