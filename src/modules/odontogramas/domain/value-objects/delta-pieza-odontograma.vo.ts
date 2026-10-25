import { EstadoAnatomicoPieza } from './estado-anatomico-pieza.enum.js';
import { TipoSuperficie } from './tipo-superficie.enum.js';
import { CondicionSuperficie } from './condicion-superficie.enum.js';
import { TipoTratamientoEstructural } from './tipo-tratamiento-estructural.enum.js';

export interface CambioSuperficieDelta {
  superficie: TipoSuperficie;
  condicionAnterior: CondicionSuperficie;
  condicionNueva: CondicionSuperficie;
}

export interface DeltaPiezaOdontogramaProps {
  numeroFDI: number;
  estadoAnatomicoAnterior?: EstadoAnatomicoPieza;
  estadoAnatomicoNuevo?: EstadoAnatomicoPieza;
  superficiesModificadas?: CambioSuperficieDelta[];
  tratamientoEstructuralAgregado?: TipoTratamientoEstructural;
  observaciones?: string | null;
}

/**
 * Value Object inmutable que describe las modificaciones exactas aplicadas a una pieza dental en una revisión.
 */
export class DeltaPiezaOdontograma {
  private readonly _numeroFDI: number;
  private readonly _estadoAnatomicoAnterior?: EstadoAnatomicoPieza;
  private readonly _estadoAnatomicoNuevo?: EstadoAnatomicoPieza;
  private readonly _superficiesModificadas: ReadonlyArray<CambioSuperficieDelta>;
  private readonly _tratamientoEstructuralAgregado?: TipoTratamientoEstructural;
  private readonly _observaciones: string | null;

  constructor(props: DeltaPiezaOdontogramaProps) {
    if (!props.numeroFDI) {
      throw new Error('El número FDI es obligatorio para registrar un delta odontográfico.');
    }

    this._numeroFDI = props.numeroFDI;
    this._estadoAnatomicoAnterior = props.estadoAnatomicoAnterior;
    this._estadoAnatomicoNuevo = props.estadoAnatomicoNuevo;
    this._superficiesModificadas = Object.freeze(
      (props.superficiesModificadas ?? []).map((s) =>
        Object.freeze({
          superficie: s.superficie,
          condicionAnterior: s.condicionAnterior,
          condicionNueva: s.condicionNueva,
        })
      )
    );
    this._tratamientoEstructuralAgregado = props.tratamientoEstructuralAgregado;
    this._observaciones = props.observaciones?.trim() || null;

    Object.freeze(this);
  }

  get numeroFDI(): number {
    return this._numeroFDI;
  }

  get estadoAnatomicoAnterior(): EstadoAnatomicoPieza | undefined {
    return this._estadoAnatomicoAnterior;
  }

  get estadoAnatomicoNuevo(): EstadoAnatomicoPieza | undefined {
    return this._estadoAnatomicoNuevo;
  }

  get superficiesModificadas(): ReadonlyArray<CambioSuperficieDelta> {
    return this._superficiesModificadas;
  }

  get tratamientoEstructuralAgregado(): TipoTratamientoEstructural | undefined {
    return this._tratamientoEstructuralAgregado;
  }

  get observaciones(): string | null {
    return this._observaciones;
  }

  toObject(): DeltaPiezaOdontogramaProps {
    return {
      numeroFDI: this._numeroFDI,
      estadoAnatomicoAnterior: this._estadoAnatomicoAnterior,
      estadoAnatomicoNuevo: this._estadoAnatomicoNuevo,
      superficiesModificadas: [...this._superficiesModificadas],
      tratamientoEstructuralAgregado: this._tratamientoEstructuralAgregado,
      observaciones: this._observaciones,
    };
  }
}
