import { describe, it, expect } from 'vitest';
import { PiezaDentalOdontograma } from './pieza-dental-odontograma.entity.js';
import { PiezaDentalFDI } from '../../../consultas-odontologicas/domain/value-objects/pieza-dental-fdi.vo.js';
import { EstadoAnatomicoPieza } from '../value-objects/estado-anatomico-pieza.enum.js';
import { EstadoEvaluacionPieza } from '../value-objects/estado-evaluacion-pieza.enum.js';
import { TipoSuperficie } from '../value-objects/tipo-superficie.enum.js';
import { CondicionSuperficie } from '../value-objects/condicion-superficie.enum.js';
import { TipoTratamientoEstructural } from '../value-objects/tipo-tratamiento-estructural.enum.js';
import { TratamientoEstructural } from '../value-objects/tratamiento-estructural.vo.js';
import { EstadoAnatomicoIncompatibleError } from '../errors/estado-anatomico-incompatible.error.js';
import { SuperficieIncisalIncompatibleError } from '../errors/superficie-incisal-incompatible.error.js';

describe('PiezaDentalOdontograma (Internal Entity)', () => {
  it('1. Inicialización en estado basal neutro (INV-ODO-01)', () => {
    const fdi = PiezaDentalFDI.crear(36);
    const pieza = PiezaDentalOdontograma.crearInicial(fdi);

    expect(pieza.numeroFDI.valor).toBe(36);
    expect(pieza.estadoAnatomico).toBe(EstadoAnatomicoPieza.DESCONOCIDO);
    expect(pieza.estadoEvaluacion).toBe(EstadoEvaluacionPieza.NO_EVALUADO);
    expect(pieza.observaciones).toBeNull();
    expect(pieza.tratamientosEstructurales.length).toBe(0);

    // Las 5 superficies existen y están en NO_EVALUADA con evaluada = false
    expect(pieza.superficies.size).toBe(5);
    for (const sup of pieza.superficies.values()) {
      expect(sup.condicion).toBe(CondicionSuperficie.NO_EVALUADA);
      expect(sup.evaluada).toBe(false);
    }
  });

  it('2. Evaluación flexible de superficies (INV-ODO-03)', () => {
    const pieza = PiezaDentalOdontograma.crearInicial(PiezaDentalFDI.crear(16));
    pieza.actualizarEstadoAnatomico(EstadoAnatomicoPieza.PRESENTE);

    // Evalúa solo la superficie oclusal con caries
    pieza.establecerCondicionSuperficie(TipoSuperficie.OCLUSAL_INCISAL, CondicionSuperficie.CARIES);

    expect(pieza.estadoEvaluacion).toBe(EstadoEvaluacionPieza.EVALUADO);
    expect(pieza.superficies.get(TipoSuperficie.OCLUSAL_INCISAL)?.condicion).toBe(CondicionSuperficie.CARIES);
    expect(pieza.superficies.get(TipoSuperficie.OCLUSAL_INCISAL)?.evaluada).toBe(true);

    // Las otras cuatro superficies permanecen en NO_EVALUADA
    expect(pieza.superficies.get(TipoSuperficie.VESTIBULAR)?.condicion).toBe(CondicionSuperficie.NO_EVALUADA);
    expect(pieza.superficies.get(TipoSuperficie.MESIAL)?.condicion).toBe(CondicionSuperficie.NO_EVALUADA);
  });

  it('3. Rechaza caries o restauraciones en piezas no presentes (INV-ODO-02)', () => {
    const piezaDesconocida = PiezaDentalOdontograma.crearInicial(PiezaDentalFDI.crear(46));

    // Pieza en estado DESCONOCIDO no admite caries
    expect(() => {
      piezaDesconocida.establecerCondicionSuperficie(TipoSuperficie.OCLUSAL_INCISAL, CondicionSuperficie.CARIES);
    }).toThrow(EstadoAnatomicoIncompatibleError);

    // Pieza AUSENTE no admite obturación
    piezaDesconocida.actualizarEstadoAnatomico(EstadoAnatomicoPieza.AUSENTE);
    expect(() => {
      piezaDesconocida.establecerCondicionSuperficie(TipoSuperficie.MESIAL, CondicionSuperficie.OBTURACION_RESINA);
    }).toThrow(EstadoAnatomicoIncompatibleError);

    // Pieza EXTRAIDO no admite fractura
    piezaDesconocida.actualizarEstadoAnatomico(EstadoAnatomicoPieza.EXTRAIDO);
    expect(() => {
      piezaDesconocida.establecerCondicionSuperficie(TipoSuperficie.VESTIBULAR, CondicionSuperficie.FRACTURA);
    }).toThrow(EstadoAnatomicoIncompatibleError);

    // Pieza NO_ERUPCIONADO no admite sellante
    piezaDesconocida.actualizarEstadoAnatomico(EstadoAnatomicoPieza.NO_ERUPCIONADO);
    expect(() => {
      piezaDesconocida.establecerCondicionSuperficie(TipoSuperficie.OCLUSAL_INCISAL, CondicionSuperficie.SELLANTE);
    }).toThrow(EstadoAnatomicoIncompatibleError);
  });

  it('4. Coherencia morfológica en bordes incisales de piezas anteriores (INV-ODO-04)', () => {
    // Pieza 11 (Incisivo central superior permanente)
    const pieza11 = PiezaDentalOdontograma.crearInicial(PiezaDentalFDI.crear(11));
    pieza11.actualizarEstadoAnatomico(EstadoAnatomicoPieza.PRESENTE);

    expect(pieza11.esAnterior).toBe(true);
    expect(() => {
      pieza11.establecerCondicionSuperficie(TipoSuperficie.OCLUSAL_INCISAL, CondicionSuperficie.SELLANTE);
    }).toThrow(SuperficieIncisalIncompatibleError);

    // En cambio, admite fractura o resina en el borde incisal
    pieza11.establecerCondicionSuperficie(TipoSuperficie.OCLUSAL_INCISAL, CondicionSuperficie.FRACTURA);
    expect(pieza11.superficies.get(TipoSuperficie.OCLUSAL_INCISAL)?.condicion).toBe(CondicionSuperficie.FRACTURA);

    // Y una pieza posterior (ej. 14 premolar) sí admite sellante en oclusal
    const pieza14 = PiezaDentalOdontograma.crearInicial(PiezaDentalFDI.crear(14));
    pieza14.actualizarEstadoAnatomico(EstadoAnatomicoPieza.PRESENTE);
    expect(pieza14.esAnterior).toBe(false);
    pieza14.establecerCondicionSuperficie(TipoSuperficie.OCLUSAL_INCISAL, CondicionSuperficie.SELLANTE);
    expect(pieza14.superficies.get(TipoSuperficie.OCLUSAL_INCISAL)?.condicion).toBe(CondicionSuperficie.SELLANTE);
  });

  it('5. Tratamientos estructurales y compatibilidad anatómica', () => {
    const pieza = PiezaDentalOdontograma.crearInicial(PiezaDentalFDI.crear(26));
    pieza.actualizarEstadoAnatomico(EstadoAnatomicoPieza.PRESENTE);

    const corona = TratamientoEstructural.crear(TipoTratamientoEstructural.CORONA);
    pieza.agregarTratamientoEstructural(corona);
    expect(pieza.tratamientosEstructurales.length).toBe(1);

    // No duplica tratamientos idénticos en la misma fecha
    pieza.agregarTratamientoEstructural(corona);
    expect(pieza.tratamientosEstructurales.length).toBe(1);

    // Rechaza corona en pieza AUSENTE
    const piezaAusente = PiezaDentalOdontograma.crearInicial(PiezaDentalFDI.crear(27));
    piezaAusente.actualizarEstadoAnatomico(EstadoAnatomicoPieza.AUSENTE);
    expect(() => {
      piezaAusente.agregarTratamientoEstructural(corona);
    }).toThrow(EstadoAnatomicoIncompatibleError);

    // Admite IMPLANTE en pieza AUSENTE
    const implante = TratamientoEstructural.crear(TipoTratamientoEstructural.IMPLANTE);
    piezaAusente.agregarTratamientoEstructural(implante);
    expect(piezaAusente.tratamientosEstructurales.length).toBe(1);
  });

  it('6. Actualización a EXTRAIDO limpia superficies en proyección activa', () => {
    const pieza = PiezaDentalOdontograma.crearInicial(PiezaDentalFDI.crear(38));
    pieza.actualizarEstadoAnatomico(EstadoAnatomicoPieza.PRESENTE);
    pieza.establecerCondicionSuperficie(TipoSuperficie.OCLUSAL_INCISAL, CondicionSuperficie.CARIES);

    // Tras exodoncia pasa a EXTRAIDO
    pieza.actualizarEstadoAnatomico(EstadoAnatomicoPieza.EXTRAIDO);
    expect(pieza.estadoAnatomico).toBe(EstadoAnatomicoPieza.EXTRAIDO);
    expect(pieza.superficies.get(TipoSuperficie.OCLUSAL_INCISAL)?.condicion).toBe(CondicionSuperficie.NO_EVALUADA);
  });

  it('7. Clonación profunda e independencia de snapshots', () => {
    const pieza = PiezaDentalOdontograma.crearInicial(PiezaDentalFDI.crear(47));
    pieza.actualizarEstadoAnatomico(EstadoAnatomicoPieza.PRESENTE);
    pieza.establecerCondicionSuperficie(TipoSuperficie.VESTIBULAR, CondicionSuperficie.CARIES);

    const clon = pieza.clonar();
    expect(clon.numeroFDI.valor).toBe(47);
    expect(clon.superficies.get(TipoSuperficie.VESTIBULAR)?.condicion).toBe(CondicionSuperficie.CARIES);

    // Mutar el clon no afecta al original
    clon.establecerCondicionSuperficie(TipoSuperficie.VESTIBULAR, CondicionSuperficie.OBTURACION_RESINA);
    expect(clon.superficies.get(TipoSuperficie.VESTIBULAR)?.condicion).toBe(CondicionSuperficie.OBTURACION_RESINA);
    expect(pieza.superficies.get(TipoSuperficie.VESTIBULAR)?.condicion).toBe(CondicionSuperficie.CARIES);

    // Snapshot inmutable
    const snapshot = pieza.toSnapshot();
    expect(snapshot.numeroFDI).toBe(47);
    expect(snapshot.superficies.VESTIBULAR.condicion).toBe(CondicionSuperficie.CARIES);
  });
});
