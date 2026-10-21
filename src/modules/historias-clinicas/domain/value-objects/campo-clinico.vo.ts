/**
 * Estado epistémico de un campo clínico.
 *
 * Distingue tres situaciones clínicamente distintas:
 *  - NO_EVALUADO : el profesional aún no preguntó / no se registró.
 *  - NEGADO      : el paciente declaró explícitamente que NO tiene ese antecedente.
 *  - CONFIRMADO  : el paciente confirmó el antecedente; requiere 'detalle' no vacío.
 *
 * Esta distinción es crítica para no confundir datos faltantes con negaciones explícitas.
 */
export type EstadoEpistemico = 'NO_EVALUADO' | 'NEGADO' | 'CONFIRMADO';

export interface PropsCampoNoEvaluado {
  nombre?: string | null;
  estado: 'NO_EVALUADO';
}

export interface PropsCampoNegado {
  nombre?: string | null;
  estado: 'NEGADO';
}

export interface PropsCampoConfirmado {
  nombre?: string | null;
  estado: 'CONFIRMADO';
  /** Obligatorio cuando estado es CONFIRMADO. */
  detalle: string;
  /** Fecha en que se registró el dato confirmado. Por defecto: ahora. */
  registradoEn?: Date;
}

export type PropsCampoClinico =
  | PropsCampoNoEvaluado
  | PropsCampoNegado
  | PropsCampoConfirmado;

/**
 * Value object que representa un campo clínico con estado epistémico discriminado.
 * Inmutable; se crea mediante CampoClinico.crear().
 */
export class CampoClinico {
  readonly nombre: string | null;
  readonly estado: EstadoEpistemico;
  /** Solo presente cuando estado === 'CONFIRMADO'. */
  readonly detalle: string | null;
  /** Solo presente cuando estado === 'CONFIRMADO'. */
  readonly registradoEn: Date | null;

  private constructor(props: PropsCampoClinico) {
    if (props.estado === 'CONFIRMADO') {
      const detalle = props.detalle?.trim();
      if (!detalle) {
        const ref = props.nombre ? ` (campo: '${props.nombre}')` : '';
        throw new Error(
          `CampoClinico con estado CONFIRMADO requiere 'detalle' no vacío${ref}.`,
        );
      }
      this.detalle = detalle;
      this.registradoEn = props.registradoEn ?? new Date();
    } else {
      this.detalle = null;
      this.registradoEn = null;
    }

    this.nombre = props.nombre?.trim() ?? null;
    this.estado = props.estado;
  }

  static crear(props: PropsCampoClinico): CampoClinico {
    return new CampoClinico(props);
  }

  esConfirmado(): boolean {
    return this.estado === 'CONFIRMADO';
  }

  esNegado(): boolean {
    return this.estado === 'NEGADO';
  }

  esNoEvaluado(): boolean {
    return this.estado === 'NO_EVALUADO';
  }
}
