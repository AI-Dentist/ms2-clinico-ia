import { describe, it, expect } from 'vitest';
import { ConsultaId } from './consulta-id.vo.js';
import { MotivoConsulta } from './motivo-consulta.vo.js';
import { AnamnesisActual } from './anamnesis-actual.vo.js';
import { ExploracionFisica } from './exploracion-fisica.vo.js';
import { DiagnosticoItem } from './diagnostico-item.vo.js';
import { TipoDiagnostico } from './tipo-diagnostico.enum.js';
import { ProcedimientoRealizado } from './procedimiento-realizado.vo.js';
import { PiezaDentalFDI } from './pieza-dental-fdi.vo.js';
import { EvolucionSOAP } from './evolucion-soap.vo.js';
import { SnapshotRiesgoClinico } from './snapshot-riesgo-clinico.vo.js';

describe('Value Objects del Dominio de Consultas Odontológicas', () => {
  describe('ConsultaId', () => {
    it('debe generar identificadores con prefijo cons_ y formato uuid', () => {
      const id = ConsultaId.generar();
      expect(id.valor.startsWith('cons_')).toBe(true);
      expect(id.valor.length).toBeGreaterThan(15);
      expect(id.toString()).toBe(id.valor);
    });

    it('debe reconstituir un identificador válido', () => {
      const raw = 'cons_12345678-abcd-ef01-2345-6789abcdef01';
      const id = ConsultaId.reconstituir(raw);
      expect(id.valor).toBe(raw);
    });

    it('debe rechazar identificadores vacíos o sin prefijo cons_', () => {
      expect(() => ConsultaId.reconstituir('')).toThrow('ConsultaId no puede estar vacío');
      expect(() => ConsultaId.reconstituir('   ')).toThrow('ConsultaId no puede estar vacío');
      expect(() => ConsultaId.reconstituir('hc_12345678')).toThrow("no cumple con el formato canónico 'cons_<uuid>'");
      expect(() => ConsultaId.reconstituir('cons_1')).toThrow("no cumple con el formato canónico 'cons_<uuid>'");
    });

    it('debe comparar por igualdad (equals)', () => {
      const id1 = ConsultaId.reconstituir('cons_a1b2c3d4-1111');
      const id2 = ConsultaId.reconstituir('cons_a1b2c3d4-1111');
      const id3 = ConsultaId.reconstituir('cons_a1b2c3d4-2222');
      expect(id1.equals(id2)).toBe(true);
      expect(id1.equals(id3)).toBe(false);
    });
  });

  describe('MotivoConsulta', () => {
    it('debe crear un motivo válido', () => {
      const motivo = MotivoConsulta.crear('Dolor agudo en molar inferior');
      expect(motivo.valor).toBe('Dolor agudo en molar inferior');
      expect(motivo.toString()).toBe('Dolor agudo en molar inferior');
    });

    it('debe rechazar motivos vacíos o con longitud inferior a 5 caracteres', () => {
      expect(() => MotivoConsulta.crear('')).toThrow('El motivo de consulta no puede estar vacío');
      expect(() => MotivoConsulta.crear('   ')).toThrow('El motivo de consulta no puede estar vacío');
      expect(() => MotivoConsulta.crear('Hola')).toThrow('al menos 5 caracteres');
    });

    it('debe rechazar motivos que excedan 500 caracteres', () => {
      const textoLargo = 'A'.repeat(501);
      expect(() => MotivoConsulta.crear(textoLargo)).toThrow('no puede exceder 500 caracteres');
    });
  });

  describe('AnamnesisActual', () => {
    it('debe crear anamnesis con escala de dolor EVA válida (0 a 10)', () => {
      const anamnesis = AnamnesisActual.crear({
        descripcion: 'Dolor pulsátil continuo tras estímulo térmico',
        tiempoEvolucion: '48 horas',
        escalaDolorEVA: 8,
      });
      expect(anamnesis.descripcion).toBe('Dolor pulsátil continuo tras estímulo térmico');
      expect(anamnesis.tiempoEvolucion).toBe('48 horas');
      expect(anamnesis.escalaDolorEVA).toBe(8);
      expect(anamnesis.tieneDolor).toBe(true);
    });

    it('debe rechazar valores de escala EVA fuera de 0..10 o no enteros', () => {
      expect(() =>
        AnamnesisActual.crear({ descripcion: 'Test', escalaDolorEVA: -1 })
      ).toThrow('entero entre 0 y 10');
      expect(() =>
        AnamnesisActual.crear({ descripcion: 'Test', escalaDolorEVA: 11 })
      ).toThrow('entero entre 0 y 10');
      expect(() =>
        AnamnesisActual.crear({ descripcion: 'Test', escalaDolorEVA: 5.5 })
      ).toThrow('entero entre 0 y 10');
    });

    it('debe crear anamnesis vacía por defecto', () => {
      const vacia = AnamnesisActual.vacia();
      expect(vacia.descripcion).toBe('');
      expect(vacia.tiempoEvolucion).toBeNull();
      expect(vacia.escalaDolorEVA).toBeNull();
      expect(vacia.tieneDolor).toBe(false);
    });
  });

  describe('ExploracionFisica', () => {
    it('debe evaluar la presencia de inspección intraoral suficiente', () => {
      const conIntraoral = ExploracionFisica.crear({
        inspeccionIntraoral: 'Mucosa y encías normocoloreadas, sin sangrado al sondaje.',
        inspeccionExtraoral: 'Sin adenopatías.',
      });
      expect(conIntraoral.tieneInspeccionIntraoral).toBe(true);
      expect(conIntraoral.inspeccionExtraoral).toBe('Sin adenopatías.');

      const insuficiente = ExploracionFisica.crear({
        inspeccionIntraoral: 'Ok',
      });
      expect(insuficiente.tieneInspeccionIntraoral).toBe(false);

      const vacia = ExploracionFisica.vacia();
      expect(vacia.tieneInspeccionIntraoral).toBe(false);
      expect(vacia.inspeccionExtraoral).toBeNull();
    });
  });

  describe('DiagnosticoItem', () => {
    it('debe crear diagnósticos presuntivos y definitivos con CIE-10 opcional', () => {
      const d1 = DiagnosticoItem.crear({
        codigoCIE10: 'K04.0',
        descripcion: 'Pulpitis irreversible sintomática',
        tipo: TipoDiagnostico.DEFINITIVO,
      });
      expect(d1.codigoCIE10).toBe('K04.0');
      expect(d1.descripcion).toBe('Pulpitis irreversible sintomática');
      expect(d1.esDefinitivo).toBe(true);
      expect(d1.esPresuntivo).toBe(false);

      const d2 = DiagnosticoItem.crear({
        descripcion: 'Sospecha de fisura radicular',
        tipo: TipoDiagnostico.PRESUNTIVO,
      });
      expect(d2.codigoCIE10).toBeNull();
      expect(d2.esDefinitivo).toBe(false);
      expect(d2.esPresuntivo).toBe(true);
    });

    it('debe rechazar diagnóstico con descripción vacía', () => {
      expect(() =>
        DiagnosticoItem.crear({ descripcion: '', tipo: TipoDiagnostico.DEFINITIVO })
      ).toThrow('La descripción del diagnóstico no puede estar vacía');
    });
  });

  describe('ProcedimientoRealizado', () => {
    it('debe crear procedimiento asociado a pieza dental FDI', () => {
      const pieza = PiezaDentalFDI.crear(36);
      const proc = ProcedimientoRealizado.crear({
        codigo: 'END-01',
        descripcion: 'Pulpectomía cameral de urgencia',
        piezaDental: pieza,
        observaciones: 'Aislamiento absoluto con dique de goma',
      });
      expect(proc.codigo).toBe('END-01');
      expect(proc.descripcion).toBe('Pulpectomía cameral de urgencia');
      expect(proc.afectaPiezaDental).toBe(true);
      expect(proc.piezaDental?.valor).toBe(36);
      expect(proc.observaciones).toBe('Aislamiento absoluto con dique de goma');
    });

    it('debe permitir procedimiento sin pieza dental (ej: limpieza general)', () => {
      const proc = ProcedimientoRealizado.crear({
        descripcion: 'Profilaxis dental e instrucción de higiene oral',
      });
      expect(proc.afectaPiezaDental).toBe(false);
      expect(proc.piezaDental).toBeNull();
    });

    it('debe rechazar procedimiento con descripción vacía', () => {
      expect(() => ProcedimientoRealizado.crear({ descripcion: '' })).toThrow(
        'La descripción del procedimiento no puede estar vacía'
      );
    });
  });

  describe('EvolucionSOAP', () => {
    it('debe almacenar notas SOAP complementarias', () => {
      const soap = EvolucionSOAP.crear({
        subjetivo: 'Paciente sin dolor tras intervención previa.',
        objetivo: 'Tejido gingival cicatrizando favorablemente.',
        analisis: 'Evolución post-operatoria satisfactoria.',
        plan: 'Control clínico en 15 días.',
      });
      expect(soap.tieneContenido).toBe(true);
      expect(soap.subjetivo).toContain('Paciente sin dolor');
      expect(soap.plan).toContain('15 días');
    });

    it('debe identificar nota SOAP vacía', () => {
      const vacia = EvolucionSOAP.vacia();
      expect(vacia.tieneContenido).toBe(false);
      expect(vacia.subjetivo).toBeNull();
    });
  });

  describe('SnapshotRiesgoClinico (Inmutabilidad y Trazabilidad)', () => {
    it('debe congelar de forma inmutable las alertas y alergias del paciente', () => {
      const fechaFijada = new Date('2026-10-22T12:00:00.000Z');
      const snapshot = SnapshotRiesgoClinico.capturar({
        alergiasCriticas: [{ sustancia: 'Penicilina', severidad: 'GRAVE' }],
        condicionesMedicas: ['Hipertensión arterial', 'Diabetes Mellitus Tipo 2'],
        medicacionHabitual: ['Enalapril 10mg'],
        capturadoEn: fechaFijada,
      });

      expect(snapshot.tieneAlergiasRegistradas).toBe(true);
      expect(snapshot.tieneAlertasMedicas).toBe(true);
      expect(snapshot.alergiasCriticas.length).toBe(1);
      expect(snapshot.alergiasCriticas[0].sustancia).toBe('Penicilina');
      expect(snapshot.condicionesMedicas).toContain('Hipertensión arterial');
      expect(snapshot.medicacionHabitual).toContain('Enalapril 10mg');
      expect(snapshot.capturadoEn.toISOString()).toBe(fechaFijada.toISOString());

      // Verificar inmutabilidad estricta (Object.isFrozen)
      expect(Object.isFrozen(snapshot)).toBe(true);
      expect(Object.isFrozen(snapshot.alergiasCriticas)).toBe(true);
      expect(Object.isFrozen(snapshot.alergiasCriticas[0])).toBe(true);
      expect(Object.isFrozen(snapshot.condicionesMedicas)).toBe(true);
      expect(Object.isFrozen(snapshot.medicacionHabitual)).toBe(true);
    });

    it('debe impedir mutaciones directas sobre sus propiedades y elementos anidados lanzando TypeError', () => {
      const snapshot = SnapshotRiesgoClinico.capturar({
        alergiasCriticas: [{ sustancia: 'Latex', severidad: 'MODERADA' }],
        condicionesMedicas: ['Asma'],
      });

      // Intento de mutar el array de alergias
      expect(() => {
        (snapshot.alergiasCriticas as unknown as unknown[]).push({ sustancia: 'Penicilina', severidad: 'GRAVE' });
      }).toThrow(TypeError);

      // Intento de mutar un objeto anidado dentro del array de alergias
      expect(() => {
        (snapshot.alergiasCriticas[0] as { sustancia: string }).sustancia = 'Alterado';
      }).toThrow(TypeError);

      // Intento de mutar el array de condiciones médicas
      expect(() => {
        (snapshot.condicionesMedicas as unknown as string[]).push('Diabetes');
      }).toThrow(TypeError);

      // Intento de mutar la fecha interna mediante el getter
      const fechaObtenida = snapshot.capturadoEn;
      fechaObtenida.setFullYear(1990);
      expect(snapshot.capturadoEn.getFullYear()).not.toBe(1990);
    });

    it('debe aislarse completamente de mutaciones en los arreglos u objetos pasados por el llamador', () => {
      const alergiasInput = [{ sustancia: 'Amoxicilina', severidad: 'GRAVE' }];
      const condicionesInput = ['Cardiopatía'];
      const snapshot = SnapshotRiesgoClinico.capturar({
        alergiasCriticas: alergiasInput,
        condicionesMedicas: condicionesInput,
      });

      // El llamador muta sus referencias originales externas
      alergiasInput.push({ sustancia: 'Ibuprofeno', severidad: 'LEVE' });
      alergiasInput[0].sustancia = 'Mutada';
      condicionesInput.push('Epilepsia');

      // El snapshot permanece inalterado
      expect(snapshot.alergiasCriticas.length).toBe(1);
      expect(snapshot.alergiasCriticas[0].sustancia).toBe('Amoxicilina');
      expect(snapshot.condicionesMedicas.length).toBe(1);
      expect(snapshot.condicionesMedicas[0]).toBe('Cardiopatía');
    });

    it('debe generar snapshot vacío sin alertas', () => {
      const vacio = SnapshotRiesgoClinico.vacio();
      expect(vacio.tieneAlergiasRegistradas).toBe(false);
      expect(vacio.tieneAlertasMedicas).toBe(false);
      expect(vacio.alergiasCriticas.length).toBe(0);
      expect(vacio.condicionesMedicas.length).toBe(0);
    });
  });
});
