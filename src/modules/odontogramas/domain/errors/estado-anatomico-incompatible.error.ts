import { EstadoAnatomicoPieza } from '../value-objects/estado-anatomico-pieza.enum.js';
import { CondicionSuperficie } from '../value-objects/condicion-superficie.enum.js';

/**
 * Se lanza cuando se intenta registrar una condición clínica de superficie incompatible
 * con el estado anatómico de la pieza (INV-ODO-02).
 */
export class EstadoAnatomicoIncompatibleError extends Error {
  readonly codigo = 'ESTADO_ANATOMICO_INCOMPATIBLE';
  readonly numeroFDI: number;
  readonly estadoAnatomico: EstadoAnatomicoPieza;
  readonly condicionIntentada: CondicionSuperficie;

  constructor(numeroFDI: number, estadoAnatomico: EstadoAnatomicoPieza, condicionIntentada: CondicionSuperficie) {
    super(
      `Incompatibilidad anatómica en pieza ${numeroFDI}: no es posible registrar la condición '${condicionIntentada}' cuando la pieza tiene estado anatómico '${estadoAnatomico}'. Solo piezas con estado PRESENTE admiten lesiones o restauraciones de superficie.`
    );
    this.name = 'EstadoAnatomicoIncompatibleError';
    this.numeroFDI = numeroFDI;
    this.estadoAnatomico = estadoAnatomico;
    this.condicionIntentada = condicionIntentada;
  }
}
