import { CategoriaEstudio } from '../enums/categoria-estudio.enum.js';
import { EstadoCatalogo } from '../enums/estado-catalogo.enum.js';

export interface TipoEstudioProps {
  id: string;
  codigo: string;
  nombre: string;
  categoria: CategoriaEstudio;
  descripcion: string;
  estado: EstadoCatalogo;
  creadoEn: Date;
  actualizadoEn: Date;
}

export class TipoEstudio {
  private _id: string;
  private _codigo: string;
  private _nombre: string;
  private _categoria: CategoriaEstudio;
  private _descripcion: string;
  private _estado: EstadoCatalogo;
  private _creadoEn: Date;
  private _actualizadoEn: Date;

  constructor(props: TipoEstudioProps) {
    this.validarCodigo(props.codigo);
    this.validarNombre(props.nombre);
    this._id = props.id;
    this._codigo = props.codigo.trim().toUpperCase();
    this._nombre = props.nombre.trim();
    this._categoria = props.categoria;
    this._descripcion = props.descripcion ? props.descripcion.trim() : '';
    this._estado = props.estado ?? EstadoCatalogo.ACTIVO;
    this._creadoEn = props.creadoEn ?? new Date();
    this._actualizadoEn = props.actualizadoEn ?? new Date();
  }

  static crear(props: {
    id: string;
    codigo: string;
    nombre: string;
    categoria: CategoriaEstudio;
    descripcion: string;
  }): TipoEstudio {
    const ahora = new Date();
    return new TipoEstudio({
      id: props.id,
      codigo: props.codigo,
      nombre: props.nombre,
      categoria: props.categoria,
      descripcion: props.descripcion,
      estado: EstadoCatalogo.ACTIVO,
      creadoEn: ahora,
      actualizadoEn: ahora,
    });
  }

  static reconstituir(props: TipoEstudioProps): TipoEstudio {
    return new TipoEstudio(props);
  }

  get id(): string {
    return this._id;
  }

  get codigo(): string {
    return this._codigo;
  }

  get nombre(): string {
    return this._nombre;
  }

  get categoria(): CategoriaEstudio {
    return this._categoria;
  }

  get descripcion(): string {
    return this._descripcion;
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
    categoria?: CategoriaEstudio;
  }): void {
    if (props.nombre !== undefined) {
      this.validarNombre(props.nombre);
      this._nombre = props.nombre.trim();
    }
    if (props.descripcion !== undefined) {
      this._descripcion = props.descripcion.trim();
    }
    if (props.categoria !== undefined) {
      this._categoria = props.categoria;
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

  private validarCodigo(codigo: string): void {
    if (!codigo || !codigo.trim()) {
      throw new Error('El código del tipo de estudio es obligatorio y no puede estar vacío.');
    }
    if (codigo.trim().length < 2) {
      throw new Error('El código del tipo de estudio debe tener al menos 2 caracteres.');
    }
  }

  private validarNombre(nombre: string): void {
    if (!nombre || !nombre.trim()) {
      throw new Error('El nombre del tipo de estudio es obligatorio y no puede estar vacío.');
    }
    if (nombre.trim().length < 3) {
      throw new Error('El nombre del tipo de estudio debe tener al menos 3 caracteres.');
    }
  }
}
