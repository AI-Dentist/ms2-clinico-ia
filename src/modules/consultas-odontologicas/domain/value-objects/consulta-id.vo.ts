import { randomUUID } from 'node:crypto';

/**
 * Identificador único canónico de una Consulta Odontológica.
 * Sigue el patrón 'cons_<uuid_v4>' (INV-CONS-01).
 */
export class ConsultaId {
  private readonly _valor: string;

  private constructor(valor: string) {
    const v = valor?.trim();
    if (!v) {
      throw new Error('ConsultaId no puede estar vacío.');
    }
    if (!v.startsWith('cons_') || v.length < 10) {
      throw new Error(`ConsultaId '${v}' no cumple con el formato canónico 'cons_<uuid>'.`);
    }
    this._valor = v;
  }

  /** Genera un nuevo ConsultaId con prefijo 'cons_' y UUID v4. */
  static generar(): ConsultaId {
    return new ConsultaId(`cons_${randomUUID()}`);
  }

  /** Reconstituye un ConsultaId persistido o recibido. */
  static reconstituir(valor: string): ConsultaId {
    return new ConsultaId(valor);
  }

  get valor(): string {
    return this._valor;
  }

  /**
   * Extrae el UUID canónico puro sin el prefijo 'cons_'.
   * Usado exclusivamente en la capa de integración para contratos externos (ej. MS1 / RabbitMQ).
   */
  toCanonicalUuid(): string {
    if (!this._valor.startsWith('cons_')) {
      throw new Error(`ConsultaId '${this._valor}' no cuenta con el prefijo esperado 'cons_'.`);
    }
    const rawUuid = this._valor.slice(5);
    const UUID_REGEX =
      /^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$/;
    if (!UUID_REGEX.test(rawUuid)) {
      throw new Error(
        `El valor extraído '${rawUuid}' de '${this._valor}' no cumple con el formato UUID RFC 4122 requerido para integración.`,
      );
    }
    return rawUuid;
  }

  equals(otro: ConsultaId): boolean {
    return this._valor === otro._valor;
  }

  toString(): string {
    return this._valor;
  }
}
