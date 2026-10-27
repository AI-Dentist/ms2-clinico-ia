export interface ValorReferencia {
  parametro: string;
  valor: string;
  unidad?: string;
  estado?: string;
}

export interface ResultadoEstudioProps {
  id: string;
  solicitudEstudioId: string;
  laboratorioId?: string | null;
  fechaResultado: Date;
  registradoPor: string;
  resumen: string;
  observaciones?: string | null;
  valoresReferencia?: ValorReferencia[] | null;
  registradoEn: Date;
}

export class ResultadoEstudio {
  private _id: string;
  private _solicitudEstudioId: string;
  private _laboratorioId: string | null;
  private _fechaResultado: Date;
  private _registradoPor: string;
  private _resumen: string;
  private _observaciones: string | null;
  private _valoresReferencia: ValorReferencia[];
  private _registradoEn: Date;

  constructor(props: ResultadoEstudioProps) {
    this.validarResumen(props.resumen);
    this._id = props.id;
    this._solicitudEstudioId = props.solicitudEstudioId;
    this._laboratorioId = props.laboratorioId ? props.laboratorioId.trim() : null;
    this._fechaResultado = props.fechaResultado ?? new Date();
    this._registradoPor = props.registradoPor.trim();
    this._resumen = props.resumen.trim();
    this._observaciones = props.observaciones ? props.observaciones.trim() : null;
    this._valoresReferencia = props.valoresReferencia ?? [];
    this._registradoEn = props.registradoEn ?? new Date();
  }

  static crear(props: {
    id: string;
    solicitudEstudioId: string;
    laboratorioId?: string | null;
    fechaResultado?: Date;
    registradoPor: string;
    resumen: string;
    observaciones?: string | null;
    valoresReferencia?: ValorReferencia[] | null;
  }): ResultadoEstudio {
    return new ResultadoEstudio({
      id: props.id,
      solicitudEstudioId: props.solicitudEstudioId,
      laboratorioId: props.laboratorioId,
      fechaResultado: props.fechaResultado ?? new Date(),
      registradoPor: props.registradoPor,
      resumen: props.resumen,
      observaciones: props.observaciones,
      valoresReferencia: props.valoresReferencia,
      registradoEn: new Date(),
    });
  }

  static reconstituir(props: ResultadoEstudioProps): ResultadoEstudio {
    return new ResultadoEstudio(props);
  }

  get id(): string {
    return this._id;
  }

  get solicitudEstudioId(): string {
    return this._solicitudEstudioId;
  }

  get laboratorioId(): string | null {
    return this._laboratorioId;
  }

  get fechaResultado(): Date {
    return this._fechaResultado;
  }

  get registradoPor(): string {
    return this._registradoPor;
  }

  get resumen(): string {
    return this._resumen;
  }

  get observaciones(): string | null {
    return this._observaciones;
  }

  get valoresReferencia(): ReadonlyArray<ValorReferencia> {
    return this._valoresReferencia;
  }

  get registradoEn(): Date {
    return this._registradoEn;
  }

  private validarResumen(resumen: string): void {
    if (!resumen || !resumen.trim()) {
      throw new Error('El resumen del resultado clínico es obligatorio.');
    }
  }
}
