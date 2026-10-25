import { describe, it, expect } from 'vitest';
import { OdontogramaId } from './odontograma-id.vo.js';
import { RevisionId } from './revision-id.vo.js';
import { SuperficieDental } from './superficie-dental.vo.js';
import { TratamientoEstructural } from './tratamiento-estructural.vo.js';
import { DeltaPiezaOdontograma } from './delta-pieza-odontograma.vo.js';
import { TipoSuperficie } from './tipo-superficie.enum.js';
import { CondicionSuperficie } from './condicion-superficie.enum.js';
import { TipoTratamientoEstructural } from './tipo-tratamiento-estructural.enum.js';
import { EstadoAnatomicoPieza } from './estado-anatomico-pieza.enum.js';
import { ConsultaId } from '../../../consultas-odontologicas/domain/value-objects/consulta-id.vo.js';

describe('Odontogramas Domain — Value Objects', () => {
  describe('OdontogramaId', () => {
    it('debe generar un identificador canónico válido con prefijo odo_', () => {
      const id = OdontogramaId.generar();
      expect(id.valor.startsWith('odo_')).toBe(true);
      expect(id.valor.length).toBeGreaterThan(10);
    });

    it('debe reconstituir un identificador válido', () => {
      const valor = 'odo_12345678-aaaa-bbbb-cccc-111122223333';
      const id = OdontogramaId.reconstituir(valor);
      expect(id.valor).toBe(valor);
      expect(id.toString()).toBe(valor);
    });

    it('debe rechazar identificadores vacíos o sin prefijo odo_', () => {
      expect(() => OdontogramaId.reconstituir('')).toThrow('OdontogramaId no puede estar vacío');
      expect(() => OdontogramaId.reconstituir('cons_1234567890')).toThrow("no cumple con el formato canónico 'odo_<uuid>'");
    });

    it('debe comparar igualdad por valor', () => {
      const id1 = OdontogramaId.reconstituir('odo_12345678-aaaa-bbbb-cccc-111122223333');
      const id2 = OdontogramaId.reconstituir('odo_12345678-aaaa-bbbb-cccc-111122223333');
      const id3 = OdontogramaId.generar();
      expect(id1.equals(id2)).toBe(true);
      expect(id1.equals(id3)).toBe(false);
    });
  });

  describe('RevisionId', () => {
    it('debe generar un identificador canónico válido con prefijo rev_odo_', () => {
      const id = RevisionId.generar();
      expect(id.valor.startsWith('rev_odo_')).toBe(true);
      expect(id.valor.length).toBeGreaterThan(14);
    });

    it('debe rechazar identificadores sin formato canónico', () => {
      expect(() => RevisionId.reconstituir('')).toThrow('RevisionId no puede estar vacío');
      expect(() => RevisionId.reconstituir('odo_1234567890')).toThrow("no cumple con el formato canónico 'rev_odo_<uuid>'");
    });

    it('debe comparar igualdad por valor', () => {
      const id1 = RevisionId.reconstituir('rev_odo_11112222-3333-4444-5555-666677778888');
      const id2 = RevisionId.reconstituir('rev_odo_11112222-3333-4444-5555-666677778888');
      expect(id1.equals(id2)).toBe(true);
    });
  });

  describe('SuperficieDental', () => {
    it('debe crear superficie no evaluada', () => {
      const sup = SuperficieDental.crearNoEvaluada(TipoSuperficie.OCLUSAL_INCISAL);
      expect(sup.superficie).toBe(TipoSuperficie.OCLUSAL_INCISAL);
      expect(sup.condicion).toBe(CondicionSuperficie.NO_EVALUADA);
      expect(sup.evaluada).toBe(false);
      expect(sup.tienePatologia).toBe(false);
      expect(sup.tieneRestauracion).toBe(false);
    });

    it('debe identificar patologías (caries y fractura)', () => {
      const supCaries = SuperficieDental.crear(TipoSuperficie.MESIAL, CondicionSuperficie.CARIES);
      expect(supCaries.evaluada).toBe(true);
      expect(supCaries.tienePatologia).toBe(true);
      expect(supCaries.tieneRestauracion).toBe(false);

      const supFractura = SuperficieDental.crear(TipoSuperficie.VESTIBULAR, CondicionSuperficie.FRACTURA);
      expect(supFractura.tienePatologia).toBe(true);
    });

    it('debe identificar restauraciones (resina, amalgama, sellante)', () => {
      const supResina = SuperficieDental.crear(TipoSuperficie.DISTAL, CondicionSuperficie.OBTURACION_RESINA);
      expect(supResina.tieneRestauracion).toBe(true);
      expect(supResina.tienePatologia).toBe(false);

      const supAmalgama = SuperficieDental.crear(TipoSuperficie.OCLUSAL_INCISAL, CondicionSuperficie.OBTURACION_AMALGAMA);
      expect(supAmalgama.tieneRestauracion).toBe(true);

      const supSellante = SuperficieDental.crear(TipoSuperficie.OCLUSAL_INCISAL, CondicionSuperficie.SELLANTE);
      expect(supSellante.tieneRestauracion).toBe(true);
    });

    it('debe permitir superficie sana examinada', () => {
      const supSana = SuperficieDental.crear(TipoSuperficie.PALATINA_LINGUAL, CondicionSuperficie.SANA);
      expect(supSana.evaluada).toBe(true);
      expect(supSana.condicion).toBe(CondicionSuperficie.SANA);
      expect(supSana.tienePatologia).toBe(false);
      expect(supSana.tieneRestauracion).toBe(false);
    });
  });

  describe('TratamientoEstructural', () => {
    it('debe crear un tratamiento estructural con copia defensiva de fecha', () => {
      const fecha = new Date('2026-10-25T10:00:00.000Z');
      const consultaId = ConsultaId.generar();
      const tratamiento = TratamientoEstructural.crear(TipoTratamientoEstructural.CORONA, consultaId, fecha);

      expect(tratamiento.tipo).toBe(TipoTratamientoEstructural.CORONA);
      expect(tratamiento.consultaId?.equals(consultaId)).toBe(true);
      expect(tratamiento.fechaRegistro.getTime()).toBe(fecha.getTime());

      // Modificación externa de fecha no debe alterar el VO
      fecha.setFullYear(2030);
      expect(tratamiento.fechaRegistro.getFullYear()).toBe(2026);
    });

    it('debe rechazar fechas inválidas', () => {
      expect(() =>
        TratamientoEstructural.reconstituir({
          tipo: TipoTratamientoEstructural.ENDODONCIA,
          fechaRegistro: new Date('invalid'),
        })
      ).toThrow('La fecha de registro del tratamiento estructural debe ser válida');
    });
  });

  describe('DeltaPiezaOdontograma', () => {
    it('debe congelar la lista de cambios de superficie inmutablemente', () => {
      const delta = new DeltaPiezaOdontograma({
        numeroFDI: 36,
        estadoAnatomicoNuevo: EstadoAnatomicoPieza.PRESENTE,
        superficiesModificadas: [
          {
            superficie: TipoSuperficie.OCLUSAL_INCISAL,
            condicionAnterior: CondicionSuperficie.CARIES,
            condicionNueva: CondicionSuperficie.OBTURACION_RESINA,
          },
        ],
        observaciones: '  Obturación exitosa  ',
      });

      expect(delta.numeroFDI).toBe(36);
      expect(delta.observaciones).toBe('Obturación exitosa');
      expect(Object.isFrozen(delta.superficiesModificadas)).toBe(true);
    });
  });
});
