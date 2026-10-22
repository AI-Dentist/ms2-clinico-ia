import { PiezaDentalFDIInvalidaError } from '../errors/pieza-dental-fdi-invalida.error.js';

/**
 * Conjunto inmutable de las 52 piezas anatómicas válidas de la nomenclatura FDI.
 * Adultos: Cuadrantes 1, 2, 3, 4 (piezas 1 a 8).
 * Temporales: Cuadrantes 5, 6, 7, 8 (piezas 1 a 5).
 */
const PIEZAS_FDI_VALIDAS: ReadonlySet<number> = new Set<number>([
  // Cuadrante 1 (Superior Derecho Permanente)
  11, 12, 13, 14, 15, 16, 17, 18,
  // Cuadrante 2 (Superior Izquierdo Permanente)
  21, 22, 23, 24, 25, 26, 27, 28,
  // Cuadrante 3 (Inferior Izquierdo Permanente)
  31, 32, 33, 34, 35, 36, 37, 38,
  // Cuadrante 4 (Inferior Derecho Permanente)
  41, 42, 43, 44, 45, 46, 47, 48,
  // Cuadrante 5 (Superior Derecho Deciduo / Temporal)
  51, 52, 53, 54, 55,
  // Cuadrante 6 (Superior Izquierdo Deciduo / Temporal)
  61, 62, 63, 64, 65,
  // Cuadrante 7 (Inferior Izquierdo Deciduo / Temporal)
  71, 72, 73, 74, 75,
  // Cuadrante 8 (Inferior Derecho Deciduo / Temporal)
  81, 82, 83, 84, 85,
]);

/**
 * Value Object que valida y encapsula una pieza dental según el sistema FDI de dos dígitos (INV-CONS-08).
 * Evita aceptar números numéricamente contiguos pero anatómicamente inexistentes (ej: 19, 20, 29, 56, etc.).
 */
export class PiezaDentalFDI {
  private readonly _valor: number;

  private constructor(valor: number) {
    if (!Number.isInteger(valor) || !PIEZAS_FDI_VALIDAS.has(valor)) {
      throw new PiezaDentalFDIInvalidaError(valor);
    }
    this._valor = valor;
  }

  /**
   * Crea una instancia validando que pertenezca a las 52 piezas FDI.
   */
  static crear(valor: number): PiezaDentalFDI {
    return new PiezaDentalFDI(valor);
  }

  /**
   * Reconstituye una instancia ya validada desde la persistencia.
   */
  static reconstituir(valor: number): PiezaDentalFDI {
    return new PiezaDentalFDI(valor);
  }

  /**
   * Retorna el conjunto completo de las 52 piezas FDI válidas.
   */
  static get piezasValidas(): ReadonlySet<number> {
    return PIEZAS_FDI_VALIDAS;
  }

  /**
   * Verifica si un número arbitrario es una pieza FDI válida sin lanzar excepción.
   */
  static esValida(valor: number): boolean {
    return Number.isInteger(valor) && PIEZAS_FDI_VALIDAS.has(valor);
  }

  get valor(): number {
    return this._valor;
  }

  /**
   * Cuadrante anatómico (1 a 8).
   */
  get cuadrante(): number {
    return Math.floor(this._valor / 10);
  }

  /**
   * Posición de la pieza dentro del cuadrante (1 a 8 para permanentes, 1 a 5 para deciduos).
   */
  get posicion(): number {
    return this._valor % 10;
  }

  /**
   * Indica si la pieza corresponde a la dentición permanente de adulto (cuadrantes 1 al 4).
   */
  get esPermanente(): boolean {
    return this.cuadrante >= 1 && this.cuadrante <= 4;
  }

  /**
   * Indica si la pieza corresponde a la dentición temporal o decidua (cuadrantes 5 al 8).
   */
  get esDecidua(): boolean {
    return this.cuadrante >= 5 && this.cuadrante <= 8;
  }

  equals(otra: PiezaDentalFDI): boolean {
    return this._valor === otra._valor;
  }

  toString(): string {
    return this._valor.toString();
  }
}
