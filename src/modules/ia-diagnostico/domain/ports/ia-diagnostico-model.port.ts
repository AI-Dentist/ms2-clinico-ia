export interface InferenciaCnnResultado {
  probabilidadCaries: number;
  probabilidadSano: number;
  confianza: number;
  tiempoInferenciaMs: number;
  arquitectura: string;
  version: string;
}

export interface IIaDiagnosticoModelPort {
  ejecutarInferencia(tensor: any): Promise<InferenciaCnnResultado>;
}

export const IA_DIAGNOSTICO_MODEL_PORT = Symbol('IIaDiagnosticoModelPort');
