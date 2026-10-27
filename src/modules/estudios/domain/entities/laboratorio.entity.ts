import { EstadoCatalogo } from '../enums/estado-catalogo.enum.js';

export interface LaboratorioProps {
  id: string;
  nombre: string;
  descripcion: string;
  contacto?: string | null;
  estado: EstadoCatalogo;
  creadoEn: Date;
  actualizadoEn: Date;
}

export class Laboratorio {
  private _id: string;
  private _nombre: string;
  private _descripcion: string;
  private _contacto: string | null;
  private _estado: EstadoCatalogo;
  private _creadoEn: Date;
  private _actualizadoEn: Date;

  constructor(props: LaboratorioProps) {
    this.validarNombre(props.nombre);
    this._id = props.id;
    this._nombre = props.nombre.trim();
    this._descripcion = props.descripcion ? props.descripcion.trim() : '';
    this._contacto = props.contacto ? props.contacto.trim() : null;
    this._estado = props.estado ?? EstadoCatalogo.ACTIVO;
    this._creadoEn = props.creadoEn ?? new Date();
    this._actualizadoEn = props.actualizadoEn ?? new Date();
  }

  static crear(props: {
    id: string;
    nombre: string;
    descripcion: string;
    contacto?: string | null;
  }): Laboratorio {
    const ahora = new Date();
    return new Laboratorio({
      id: props.id,
      nombre: props.nombre,
      descripcion: props.descripcion,
      contacto: props.contacto,
      estado: EstadoCatalogo.ACTIVO,
      creadoEn: ahora,
      actualizadoEn: ahora,
    });
  }

  static reconstituir(props: LaboratorioProps): Laboratorio {
    return new Laboratorio(props);
  }

  get id(): string {
    return this._id;
  }

  get nombre(): string {
    return this._nombre;
  }

  get descripcion(): string {
    return this._descripcion;
  }

  get contacto(): string | null {
    return this._contacto;
  }

  get estado(): EstadoCatalogo {
    return this._estado;
  }

  get creadoEn(): Date {
    return this._creadoEn;
  }

  get actualizadoEn(): Date {
    return this._actualizadoEn;
  }

  get estaActivo(): boolean {
    return this._estado === EstadoCatalogo.ACTIVO;
  }

  actualizarDatos(props: {
    nombre?: string;
    descripcion?: string;
    contacto?: string | null;
  }): void {
    if (props.nombre !== undefined) {
      this.validarNombre(props.nombre);
      this._nombre = props.nombre.trim();
    }
    if (props.descripcion !== undefined) {
      this._descripcion = props.descripcion.trim();
    }
    if (props.contacto !== undefined) {
      this._contacto = props.contacto ? props.contacto.trim() : null;
    }
    this._actualizadoEn = new Date();
  }

  activar(): void {
    this._estado = EstadoCatalogo.ACTIVO;
    this._actualizadoEn = new Date();
  }

  desactivar(): void {
    this._estado = EstadoCatalogo.INACTIVO;
    this._actualizadoEn = new Date();
  }

  private validarNombre(nombre: string): void {
    if (!nombre || !nombre.trim()) {
      throw new Error('El nombre del laboratorio es obligatorio y no puede estar vacío.');
    }
    if (nombre.trim().length < 3) {
      throw new Error('El nombre del laboratorio debe tener al menos 3 caracteres.');
    }
  }
}
