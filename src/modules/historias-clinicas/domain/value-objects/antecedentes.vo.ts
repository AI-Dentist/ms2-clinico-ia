import { CampoClinico } from './campo-clinico.vo.js';

/**
 * Antecedentes odontológicos con campos fijos de evaluación.
 * Cada campo usa estado epistémico (NO_EVALUADO | NEGADO | CONFIRMADO).
 */
export interface AntecedentesOdontologicos {
  readonly tratamientoPrevio: CampoClinico;
  readonly protesisActual: CampoClinico;
  readonly sangradoGingival: CampoClinico;
  readonly bruxismo: CampoClinico;
}

export interface PropsAntecedentes {
  enfermedadesCronicas: CampoClinico[];
  antecedentesMedicos: CampoClinico[];
  antecedentesFamiliares: CampoClinico[];
  antecedentesOdontologicos: AntecedentesOdontologicos;
}

/**
 * Value object compuesto que agrupa todos los antecedentes personales y odontológicos.
 * Inmutable; se actualiza creando una nueva instancia mediante Antecedentes.crear().
 */
export class Antecedentes {
  readonly enfermedadesCronicas: readonly CampoClinico[];
  readonly antecedentesMedicos: readonly CampoClinico[];
  readonly antecedentesFamiliares: readonly CampoClinico[];
  readonly antecedentesOdontologicos: Readonly<AntecedentesOdontologicos>;

  private constructor(props: PropsAntecedentes) {
    this.enfermedadesCronicas = Object.freeze([...props.enfermedadesCronicas]);
    this.antecedentesMedicos = Object.freeze([...props.antecedentesMedicos]);
    this.antecedentesFamiliares = Object.freeze([...props.antecedentesFamiliares]);
    this.antecedentesOdontologicos = Object.freeze({ ...props.antecedentesOdontologicos });
  }

  static crear(props: PropsAntecedentes): Antecedentes {
    return new Antecedentes(props);
  }

  /**
   * Crea un objeto de antecedentes con todos los campos en estado NO_EVALUADO.
   * Útil para apertura de expedientes sin información previa disponible.
   */
  static porDefecto(): Antecedentes {
    const noEvaluado = () => CampoClinico.crear({ estado: 'NO_EVALUADO' });
    return new Antecedentes({
      enfermedadesCronicas: [],
      antecedentesMedicos: [],
      antecedentesFamiliares: [],
      antecedentesOdontologicos: {
        tratamientoPrevio: noEvaluado(),
        protesisActual: noEvaluado(),
        sangradoGingival: noEvaluado(),
        bruxismo: noEvaluado(),
      },
    });
  }
}
