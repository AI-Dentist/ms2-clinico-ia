import { TipoTratamientoEstructural } from './tipo-tratamiento-estructural.enum.js';
import type { ConsultaId } from '../../../consultas-odontologicas/domain/value-objects/consulta-id.vo.js';

export interface TratamientoEstructuralProps {
  tipo: TipoTratamientoEstructural;
  consultaId?: ConsultaId | null;
  fechaRegistro: Date;
}

/**
 * Value Object inmutable que modela un tratamiento estructural o protésico aplicado a la pieza completa.
 */
export class TratamientoEstructural {
  private readonly _tipo: TipoTratamientoEstructural;
  private readonly _consultaId: ConsultaId | null;
  private readonly _fechaRegistro: Date;

  private constructor(props: TratamientoEstructuralProps) {
    if (!props.tipo) {
      throw new Error('El tipo de tratamiento estructural es obligatorio.');
    }
    if (!props.fechaRegistro || !(props.fechaRegistro instanceof Date) || isNaN(props.fechaRegistro.getTime())) {
      throw new Error('La fecha de registro del tratamiento estructural debe ser válida.');
    }

    this._tipo = props.tipo;
    this._consultaId = props.consultaId ?? null;
    this._fechaRegistro = new Date(props.fechaRegistro.getTime()); // Copia defensiva

    Object.freeze(this);
  }

  static crear(tipo: TipoTratamientoEstructural, consultaId?: ConsultaId | null, ahora: Date = new Date()): TratamientoEstructural {
    return new TratamientoEstructural({
      tipo,
      consultaId,
      fechaRegistro: ahora,
    });
  }

  static reconstituir(props: TratamientoEstructuralProps): TratamientoEstructural {
    return new TratamientoEstructural(props);
  }

  get tipo(): TipoTratamientoEstructural {
    return this._tipo;
  }

  get consultaId(): ConsultaId | null {
    return this._consultaId;
  }

  get fechaRegistro(): Date {
    return new Date(this._fechaRegistro.getTime()); // Copia defensiva
  }

  equals(otro: TratamientoEstructural): boolean {
    const mismoConsulta =
      (!this._consultaId && !otro._consultaId) ||
      (this._consultaId && otro._consultaId && this._consultaId.equals(otro._consultaId));

    return (
      this._tipo === otro._tipo &&
      Boolean(mismoConsulta) &&
      this._fechaRegistro.getTime() === otro._fechaRegistro.getTime()
    );
  }

  toObject(): { tipo: TipoTratamientoEstructural; consultaId: string | null; fechaRegistro: Date } {
    return {
      tipo: this._tipo,
      consultaId: this._consultaId ? this._consultaId.valor : null,
      fechaRegistro: this.fechaRegistro,
    };
  }
}
