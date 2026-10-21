import { AccionAuditoria } from './accion-auditoria.enum.js';
import type { OdontologoId } from './odontologo-id.vo.js';

export interface PropsEntradaAuditoria {
  accion: AccionAuditoria;
  /** El ID del odontólogo se almacena como primitivo para garantizar inmutabilidad. */
  odontologoId: OdontologoId;
  /** Por defecto: fecha/hora actual en UTC. */
  fechaHora?: Date;
  /** Rutas de campo que fueron modificados, ej. ["antecedentes.enfermedadesCronicas"]. */
  camposModificados: string[];
  /** Nota opcional del profesional sobre el cambio. */
  descripcion: string | null;
}

/**
 * Value object inmutable que registra una modificación en el expediente.
 * Las entradas de auditoría son de solo adición; nunca se modifican ni eliminan.
 */
export class EntradaAuditoria {
  readonly accion: AccionAuditoria;
  /** ID del odontólogo como string primitivo (independiente del VO OdontologoId). */
  readonly odontologoId: string;
  readonly fechaHora: Date;
  readonly camposModificados: readonly string[];
  readonly descripcion: string | null;

  private constructor(props: PropsEntradaAuditoria) {
    this.accion = props.accion;
    this.odontologoId = props.odontologoId.valor;
    this.fechaHora = props.fechaHora ?? new Date();
    this.camposModificados = Object.freeze([...props.camposModificados]);
    this.descripcion = props.descripcion?.trim() ?? null;
  }

  static crear(props: PropsEntradaAuditoria): EntradaAuditoria {
    return new EntradaAuditoria(props);
  }
}
