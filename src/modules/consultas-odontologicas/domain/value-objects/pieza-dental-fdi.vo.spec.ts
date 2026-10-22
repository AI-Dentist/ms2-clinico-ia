import { describe, it, expect } from 'vitest';
import { PiezaDentalFDI } from './pieza-dental-fdi.vo.js';
import { PiezaDentalFDIInvalidaError } from '../errors/pieza-dental-fdi-invalida.error.js';

describe('PiezaDentalFDI Value Object (Validación Estricta FDI - 52 Piezas)', () => {
  it('debe aceptar exactamente las 52 piezas anatómicas del catálogo FDI', () => {
    // 32 Dientes permanentes (cuadrantes 1 al 4, piezas 1 al 8)
    for (let c = 1; c <= 4; c++) {
      for (let p = 1; p <= 8; p++) {
        const num = c * 10 + p;
        const pieza = PiezaDentalFDI.crear(num);
        expect(pieza.valor).toBe(num);
        expect(pieza.cuadrante).toBe(c);
        expect(pieza.posicion).toBe(p);
        expect(pieza.esPermanente).toBe(true);
        expect(pieza.esDecidua).toBe(false);
        expect(PiezaDentalFDI.esValida(num)).toBe(true);
      }
    }

    // 20 Dientes temporales/deciduos (cuadrantes 5 al 8, piezas 1 al 5)
    for (let c = 5; c <= 8; c++) {
      for (let p = 1; p <= 5; p++) {
        const num = c * 10 + p;
        const pieza = PiezaDentalFDI.crear(num);
        expect(pieza.valor).toBe(num);
        expect(pieza.cuadrante).toBe(c);
        expect(pieza.posicion).toBe(p);
        expect(pieza.esPermanente).toBe(false);
        expect(pieza.esDecidua).toBe(true);
        expect(PiezaDentalFDI.esValida(num)).toBe(true);
      }
    }

    expect(PiezaDentalFDI.piezasValidas.size).toBe(52);
  });

  it('debe rechazar sistemáticamente números inexistentes o fuera de la anatomía FDI', () => {
    // Números contiguos pero inexistentes comúnmente aceptados por validadores de rango simple 11..85
    const numerosInvalidos = [
      0, 1, 9, 10,
      19, 20, 29, 30, 39, 40, 49, 50,
      56, 57, 58, 59, 60, // Cuadrante 5 solo tiene 1 a 5
      66, 67, 68, 69, 70, // Cuadrante 6 solo tiene 1 a 5
      76, 77, 78, 79, 80, // Cuadrante 7 solo tiene 1 a 5
      86, 87, 88, 89, 90, // Cuadrante 8 solo tiene 1 a 5
      91, 99, 100, -11, -1,
      1.5, 36.2, NaN,
    ];

    for (const numInvalido of numerosInvalidos) {
      expect(() => PiezaDentalFDI.crear(numInvalido)).toThrow(PiezaDentalFDIInvalidaError);
      expect(PiezaDentalFDI.esValida(numInvalido)).toBe(false);
    }
  });

  it('debe incluir el código de error y el número inválido en la excepción', () => {
    try {
      PiezaDentalFDI.crear(19);
      expect.unreachable('Debió lanzar PiezaDentalFDIInvalidaError');
    } catch (error) {
      expect(error).toBeInstanceOf(PiezaDentalFDIInvalidaError);
      const e = error as PiezaDentalFDIInvalidaError;
      expect(e.codigo).toBe('PIEZA_DENTAL_FDI_INVALIDA');
      expect(e.piezaInvalida).toBe(19);
      expect(e.message).toContain('19');
    }
  });

  it('debe comparar por igualdad de valor (equals)', () => {
    const piezaA = PiezaDentalFDI.crear(16);
    const piezaB = PiezaDentalFDI.reconstituir(16);
    const piezaC = PiezaDentalFDI.crear(26);

    expect(piezaA.equals(piezaB)).toBe(true);
    expect(piezaA.equals(piezaC)).toBe(false);
    expect(piezaA.toString()).toBe('16');
  });
});
