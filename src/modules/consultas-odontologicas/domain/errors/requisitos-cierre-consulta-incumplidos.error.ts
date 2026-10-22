/**
 * Se lanza al intentar transicionar una consulta a COMPLETADA sin cumplir los requisitos clínicos mínimos (INV-CONS-05).
 */
export class RequisitosCierreConsultaIncumplidosError extends Error {
  readonly codigo = 'REQUISITOS_CIERRE_CONSULTA_INCUMPLIDOS';
  readonly motivos: string[];

  constructor(motivos: string[]) {
    super(
      `No se puede completar la consulta odontológica debido al incumplimiento de requisitos clínicos: ${motivos.join('; ')}`
    );
    this.name = 'RequisitosCierreConsultaIncumplidosError';
    this.motivos = motivos;
  }
}
