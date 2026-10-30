import crypto from 'node:crypto';
import { EstadoSolicitudEstudio } from '../enums/estado-solicitud-estudio.enum.js';
import { PrioridadEstudio } from '../enums/prioridad-estudio.enum.js';
import { ResultadoEstudio, type ArchivoAdjuntoEstudio } from './resultado-estudio.entity.js';

export interface SolicitudEstudioProps {
  id: string;
  historiaClinicaId: string;
  consultaId: string;
  pacienteId: string;
  odontologoId: string;
  tipoEstudioId: string;
  motivo: string;
  indicaciones?: string | null;
  prioridad: PrioridadEstudio;
  estado: EstadoSolicitudEstudio;
  fechaSolicitud: Date;
  motivoCancelacion?: string | null;
  resultado?: ResultadoEstudio | null;
  creadoEn: Date;
  actualizadoEn: Date;
}

export class SolicitudEstudio {
  private _id: string;
  private _historiaClinicaId: string;
  private _consultaId: string;
  private _pacienteId: string;
  private _odontologoId: string;
  private _tipoEstudioId: string;
  private _motivo: string;
  private _indicaciones: string | null;
  private _prioridad: PrioridadEstudio;
  private _estado: EstadoSolicitudEstudio;
  private _fechaSolicitud: Date;
  private _motivoCancelacion: string | null;
  private _resultado: ResultadoEstudio | null;
  private _creadoEn: Date;
  private _actualizadoEn: Date;

  constructor(props: SolicitudEstudioProps) {
    this.validarMotivo(props.motivo);
    this._id = props.id;
    this._historiaClinicaId = props.historiaClinicaId;
    this._consultaId = props.consultaId;
    this._pacienteId = props.pacienteId;
    this._odontologoId = props.odontologoId;
    this._tipoEstudioId = props.tipoEstudioId;
    this._motivo = props.motivo.trim();
    this._indicaciones = props.indicaciones ? props.indicaciones.trim() : null;
    this._prioridad = props.prioridad ?? PrioridadEstudio.RUTINA;
    this._estado = props.estado ?? EstadoSolicitudEstudio.SOLICITADO;
    this._fechaSolicitud = props.fechaSolicitud ?? new Date();
    this._motivoCancelacion = props.motivoCancelacion ? props.motivoCancelacion.trim() : null;
    this._resultado = props.resultado ?? null;
    this._creadoEn = props.creadoEn ?? new Date();
    this._actualizadoEn = props.actualizadoEn ?? new Date();
  }

  static crear(props: {
    id: string;
    historiaClinicaId: string;
    consultaId: string;
    pacienteId: string;
    odontologoId: string;
    tipoEstudioId: string;
    motivo: string;
    indicaciones?: string | null;
    prioridad?: PrioridadEstudio;
  }): SolicitudEstudio {
    const ahora = new Date();
    return new SolicitudEstudio({
      id: props.id,
      historiaClinicaId: props.historiaClinicaId,
      consultaId: props.consultaId,
      pacienteId: props.pacienteId,
      odontologoId: props.odontologoId,
      tipoEstudioId: props.tipoEstudioId,
      motivo: props.motivo,
      indicaciones: props.indicaciones,
      prioridad: props.prioridad ?? PrioridadEstudio.RUTINA,
      estado: EstadoSolicitudEstudio.SOLICITADO,
      fechaSolicitud: ahora,
      motivoCancelacion: null,
      resultado: null,
      creadoEn: ahora,
      actualizadoEn: ahora,
    });
  }

  static reconstituir(props: SolicitudEstudioProps): SolicitudEstudio {
    return new SolicitudEstudio(props);
  }

  get id(): string {
    return this._id;
  }

  get historiaClinicaId(): string {
    return this._historiaClinicaId;
  }

  get consultaId(): string {
    return this._consultaId;
  }

  get pacienteId(): string {
    return this._pacienteId;
  }

  get odontologoId(): string {
    return this._odontologoId;
  }

  get tipoEstudioId(): string {
    return this._tipoEstudioId;
  }

  get motivo(): string {
    return this._motivo;
  }

  get indicaciones(): string | null {
    return this._indicaciones;
  }

  get prioridad(): PrioridadEstudio {
    return this._prioridad;
  }

  get estado(): EstadoSolicitudEstudio {
    return this._estado;
  }

  get fechaSolicitud(): Date {
    return this._fechaSolicitud;
  }

  get motivoCancelacion(): string | null {
    return this._motivoCancelacion;
  }

  get resultado(): ResultadoEstudio | null {
    return this._resultado;
  }

  get tieneResultado(): boolean {
    return this._resultado !== null;
  }

  get creadoEn(): Date {
    return this._creadoEn;
  }

  get actualizadoEn(): Date {
    return this._actualizadoEn;
  }

  iniciarProceso(): void {
    if (this._estado !== EstadoSolicitudEstudio.SOLICITADO) {
      throw new Error(`No es posible pasar a EN_PROCESO desde el estado actual '${this._estado}'.`);
    }
    this._estado = EstadoSolicitudEstudio.EN_PROCESO;
    this._actualizadoEn = new Date();
  }

  cancelar(motivo: string): void {
    if (this._estado === EstadoSolicitudEstudio.COMPLETADO) {
      throw new Error('No es posible cancelar una solicitud que ya ha sido COMPLETADA con resultados.');
    }
    if (this._estado === EstadoSolicitudEstudio.CANCELADO) {
      throw new Error('La solicitud ya se encuentra cancelada.');
    }
    if (!motivo || !motivo.trim()) {
      throw new Error('El motivo de cancelación es obligatorio.');
    }
    this._estado = EstadoSolicitudEstudio.CANCELADO;
    this._motivoCancelacion = motivo.trim();
    this._actualizadoEn = new Date();
  }

  registrarResultado(resultado: ResultadoEstudio): void {
    if (this._estado === EstadoSolicitudEstudio.CANCELADO) {
      throw new Error('No es posible registrar resultados en una solicitud CANCELADA.');
    }
    if (this._resultado !== null) {
      throw new Error('La solicitud ya cuenta con un resultado registrado. Evitando sobrescritura silenciosa.');
    }
    this._resultado = resultado;
    this._estado = EstadoSolicitudEstudio.COMPLETADO;
    this._actualizadoEn = new Date();
  }

  adjuntarArchivo(
    archivo: ArchivoAdjuntoEstudio,
    registradoPor: string,
    resultadoId?: string,
  ): void {
    if (this._estado === EstadoSolicitudEstudio.CANCELADO) {
      throw new Error('No es posible adjuntar archivos a una solicitud de estudio cancelada.');
    }
    if (!this._resultado) {
      this._resultado = ResultadoEstudio.crear({
        id: resultadoId || `res_${crypto.randomUUID()}`,
        solicitudEstudioId: this._id,
        fechaResultado: new Date(),
        registradoPor,
        resumen: `Archivo médico adjunto: ${archivo.nombreArchivo}`,
        archivoAdjunto: archivo,
      });
      this._estado = EstadoSolicitudEstudio.COMPLETADO;
    } else {
      this._resultado = ResultadoEstudio.reconstituir({
        id: this._resultado.id,
        solicitudEstudioId: this._id,
        laboratorioId: this._resultado.laboratorioId,
        fechaResultado: this._resultado.fechaResultado,
        registradoPor: this._resultado.registradoPor,
        resumen: this._resultado.resumen,
        observaciones: this._resultado.observaciones,
        valoresReferencia: [...this._resultado.valoresReferencia],
        archivoAdjunto: archivo,
        registradoEn: this._resultado.registradoEn,
      });
    }
    this._actualizadoEn = new Date();
  }

  private validarMotivo(motivo: string): void {
    if (!motivo || !motivo.trim()) {
      throw new Error('El motivo clínico de la solicitud de estudio es obligatorio.');
    }
  }
}
