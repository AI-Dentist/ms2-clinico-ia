import { describe, it, expect } from 'vitest';
import { ServicioFacturableConsulta } from './servicio-facturable-consulta.vo.js';
import { ServicioFacturableInvalidoError } from '../errors/servicio-facturable-invalido.error.js';
import { PiezaDentalFDIInvalidaError } from '../errors/pieza-dental-fdi-invalida.error.js';

describe('ServicioFacturableConsulta Value Object', () => {
  const VALID_UUID = '550e8400-e29b-41d4-a716-446655440001';

  it('1. Debe instanciar un servicio facturable válido con precio decimal normalizado', () => {
    const item = ServicioFacturableConsulta.crear({
      servicioId: VALID_UUID,
      codigo: 'LIM-001',
      nombre: 'Limpieza Dental Ultrasonido',
      cantidad: 2,
      precioUnitarioBs: '150',
      piezaDental: 16,
    });

    expect(item.servicioId).toBe(VALID_UUID);
    expect(item.codigo).toBe('LIM-001');
    expect(item.nombre).toBe('Limpieza Dental Ultrasonido');
    expect(item.cantidad).toBe(2);
    expect(item.precioUnitarioBs).toBe('150.00');
    expect(item.piezaDental).toBe(16);
    expect(item.calcularSubtotalBs()).toBe('300.00');
  });

  it('2. Debe admitir piezaDental null u omitida', () => {
    const item = ServicioFacturableConsulta.crear({
      servicioId: VALID_UUID,
      nombre: 'Consulta Diagnóstica General',
      cantidad: 1,
      precioUnitarioBs: '80.50',
    });

    expect(item.piezaDental).toBeNull();
    expect(item.codigo).toBeNull();
    expect(item.calcularSubtotalBs()).toBe('80.50');
  });

  it('3. Debe rechazar servicioId que no sea UUID RFC 4122', () => {
    expect(() =>
      ServicioFacturableConsulta.crear({
        servicioId: 'id-no-uuid',
        nombre: 'Limpieza',
        cantidad: 1,
        precioUnitarioBs: '100.00',
      }),
    ).toThrow(ServicioFacturableInvalidoError);
  });

  it('4. Debe rechazar nombre vacío', () => {
    expect(() =>
      ServicioFacturableConsulta.crear({
        servicioId: VALID_UUID,
        nombre: '   ',
        cantidad: 1,
        precioUnitarioBs: '100.00',
      }),
    ).toThrow(ServicioFacturableInvalidoError);
  });

  it('5. Debe rechazar cantidad menor a 1 o no entera', () => {
    expect(() =>
      ServicioFacturableConsulta.crear({
        servicioId: VALID_UUID,
        nombre: 'Limpieza',
        cantidad: 0,
        precioUnitarioBs: '100.00',
      }),
    ).toThrow(ServicioFacturableInvalidoError);

    expect(() =>
      ServicioFacturableConsulta.crear({
        servicioId: VALID_UUID,
        nombre: 'Limpieza',
        cantidad: 1.5,
        precioUnitarioBs: '100.00',
      }),
    ).toThrow(ServicioFacturableInvalidoError);
  });

  it('6. Debe rechazar precio unitario con formato no numérico o inválido', () => {
    expect(() =>
      ServicioFacturableConsulta.crear({
        servicioId: VALID_UUID,
        nombre: 'Limpieza',
        cantidad: 1,
        precioUnitarioBs: 'invalido',
      }),
    ).toThrow(ServicioFacturableInvalidoError);
  });

  it('7. Debe validar que la pieza dental cumpla la nomenclatura FDI', () => {
    expect(() =>
      ServicioFacturableConsulta.crear({
        servicioId: VALID_UUID,
        nombre: 'Extracción',
        cantidad: 1,
        precioUnitarioBs: '200.00',
        piezaDental: 99, // Pieza FDI inexistente
      }),
    ).toThrow(PiezaDentalFDIInvalidaError);
  });
});

