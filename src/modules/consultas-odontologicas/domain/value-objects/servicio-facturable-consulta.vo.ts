import { PiezaDentalFDI } from './pieza-dental-fdi.vo.js';
import { ServicioFacturableInvalidoError } from '../errors/servicio-facturable-invalido.error.js';

export interface ServicioFacturableConsultaProps {
  servicioId: string;
  codigo?: string | null;
  nombre: string;
  cantidad: number;
  precioUnitarioBs: string;
  piezaDental?: number | null;
}

const UUID_REGEX =
  /^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$/;

const PRECIO_DECIMAL_REGEX = /^\d+(\.\d{1,2})?$/;

/**
 * Value Object inmutable que representa un servicio facturable originado en el
 * catálogo maestro de MS1 y realizado durante una consulta odontológica en MS2.
 *
 * Mantiene total independencia conceptual de los procedimientos clínicos (ProcedimientoRealizado).
 * Congela el precio unitario oficial como string decimal exacto al momento del cierre.
 */
export class ServicioFacturableConsulta {
  private readonly _servicioId: string;
  private readonly _codigo: string | null;
  private readonly _nombre: string;
  private readonly _cantidad: number;
  private readonly _precioUnitarioBs: string;
  private readonly _piezaDental: number | null;

  private constructor(props: ServicioFacturableConsultaProps) {
    const id = props.servicioId?.trim();
    if (!id || !UUID_REGEX.test(id)) {
      throw new ServicioFacturableInvalidoError(
        `El servicioId '${props.servicioId}' no tiene un formato UUID canónico válido según el contrato de MS1.`,
      );
    }

    const nombre = props.nombre?.trim();
    if (!nombre) {
      throw new ServicioFacturableInvalidoError(
        'El nombre del servicio facturable es obligatorio.',
      );
    }

    if (!Number.isInteger(props.cantidad) || props.cantidad < 1) {
      throw new ServicioFacturableInvalidoError(
        `La cantidad del servicio '${nombre}' debe ser un entero mayor o igual a 1 (recibido: ${props.cantidad}).`,
      );
    }

    const precio = props.precioUnitarioBs?.trim();
    if (!precio || !PRECIO_DECIMAL_REGEX.test(precio)) {
      throw new ServicioFacturableInvalidoError(
        `El precio unitario '${props.precioUnitarioBs}' no cumple con el formato decimal monetario exacto (ej: '150.00').`,
      );
    }

    // Normalizar a 2 decimales exactos
    const precioNormalizado = Number(precio).toFixed(2);

    let piezaDental: number | null = null;
    if (props.piezaDental !== undefined && props.piezaDental !== null) {
      // Valida la pieza contra las 52 piezas anatómicas FDI
      PiezaDentalFDI.crear(props.piezaDental);
      piezaDental = props.piezaDental;
    }

    this._servicioId = id;
    this._codigo = props.codigo?.trim() || null;
    this._nombre = nombre;
    this._cantidad = props.cantidad;
    this._precioUnitarioBs = precioNormalizado;
    this._piezaDental = piezaDental;
  }

  static crear(props: ServicioFacturableConsultaProps): ServicioFacturableConsulta {
    return new ServicioFacturableConsulta(props);
  }

  static reconstituir(props: ServicioFacturableConsultaProps): ServicioFacturableConsulta {
    return new ServicioFacturableConsulta(props);
  }

  get servicioId(): string {
    return this._servicioId;
  }

  get codigo(): string | null {
    return this._codigo;
  }

  get nombre(): string {
    return this._nombre;
  }

  get cantidad(): number {
    return this._cantidad;
  }

  get precioUnitarioBs(): string {
    return this._precioUnitarioBs;
  }

  get piezaDental(): number | null {
    return this._piezaDental;
  }

  calcularSubtotalBs(): string {
    const total = Number(this._precioUnitarioBs) * this._cantidad;
    return total.toFixed(2);
  }
}
