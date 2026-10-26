import {
  registerDecorator,
  type ValidationOptions,
  type ValidationArguments,
} from 'class-validator';
import { PiezaDentalFDI } from '../../../../consultas-odontologicas/domain/value-objects/pieza-dental-fdi.vo.js';

/**
 * Validador personalizado para class-validator que valida estrictamente
 * que un número de pieza dental pertenezca a las 52 posiciones válidas de la
 * nomenclatura FDI (INV-CONS-08). Rechaza números no anatómicos como 19, 20, 29, 56, etc.
 */
export function EsNumeroFDIValido(validationOptions?: ValidationOptions) {
  return function (object: object, propertyName: string) {
    registerDecorator({
      name: 'esNumeroFDIValido',
      target: object.constructor,
      propertyName: propertyName,
      options: validationOptions ?? {
        message: 'El número de pieza dental FDI no es válido dentro del sistema anatómico de 52 posiciones.',
      },
      validator: {
        validate(value: unknown, _args: ValidationArguments): boolean {
          return typeof value === 'number' && PiezaDentalFDI.esValida(value);
        },
      },
    });
  };
}
