import { HallazgoIa } from '../enums/hallazgo-ia.enum.js';
import { SeveridadLesion } from '../enums/severidad-lesion.enum.js';

export interface MetadataImagen {
  nombreArchivo: string;
  mimeType: string;
  tamanioBytes: number;
  anchoOriginal: number;
  altoOriginal: number;
  canales: number;
}

export interface ModeloInfo {
  nombre: string;
  arquitectura: string;
  version: string;
}

export interface AnalisisRadiografiaProps {
  id: string;
  probabilidadCaries: number;
  probabilidadSano: number;
  confianza: number;
  hallazgo: HallazgoIa;
  severidad: SeveridadLesion;
  clasificacion: string;
  tiempoInferenciaMs: number;
  recomendacionClinica: string;
  modeloInfo: ModeloInfo;
  metadataImagen: MetadataImagen;
  fechaAnalisis: Date;
}

export class AnalisisRadiografia {
  private readonly _id: string;
  private readonly _probabilidadCaries: number;
  private readonly _probabilidadSano: number;
  private readonly _confianza: number;
  private readonly _hallazgo: HallazgoIa;
  private readonly _severidad: SeveridadLesion;
  private readonly _clasificacion: string;
  private readonly _tiempoInferenciaMs: number;
  private readonly _recomendacionClinica: string;
  private readonly _modeloInfo: ModeloInfo;
  private readonly _metadataImagen: MetadataImagen;
  private readonly _fechaAnalisis: Date;

  constructor(props: AnalisisRadiografiaProps) {
    this._id = props.id;
    this._probabilidadCaries = props.probabilidadCaries;
    this._probabilidadSano = props.probabilidadSano;
    this._confianza = props.confianza;
    this._hallazgo = props.hallazgo;
    this._severidad = props.severidad;
    this._clasificacion = props.clasificacion;
    this._tiempoInferenciaMs = props.tiempoInferenciaMs;
    this._recomendacionClinica = props.recomendacionClinica;
    this._modeloInfo = props.modeloInfo;
    this._metadataImagen = props.metadataImagen;
    this._fechaAnalisis = props.fechaAnalisis ?? new Date();
  }

  static crear(props: AnalisisRadiografiaProps): AnalisisRadiografia {
    return new AnalisisRadiografia(props);
  }

  get id(): string {
    return this._id;
  }

  get probabilidadCaries(): number {
    return this._probabilidadCaries;
  }

  get probabilidadSano(): number {
    return this._probabilidadSano;
  }

  get confianza(): number {
    return this._confianza;
  }

  get hallazgo(): HallazgoIa {
    return this._hallazgo;
  }

  get severidad(): SeveridadLesion {
    return this._severidad;
  }

  get clasificacion(): string {
    return this._clasificacion;
  }

  get tiempoInferenciaMs(): number {
    return this._tiempoInferenciaMs;
  }

  get recomendacionClinica(): string {
    return this._recomendacionClinica;
  }

  get modeloInfo(): ModeloInfo {
    return this._modeloInfo;
  }

  get metadataImagen(): MetadataImagen {
    return this._metadataImagen;
  }

  get fechaAnalisis(): Date {
    return this._fechaAnalisis;
  }
}
