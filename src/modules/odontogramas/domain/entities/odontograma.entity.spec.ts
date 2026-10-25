import { describe, it, expect } from 'vitest';
import { Odontograma } from './odontograma.entity.js';
import { RevisionId } from '../value-objects/revision-id.vo.js';
import { HistoriaClinicaId } from '../../../historias-clinicas/domain/value-objects/historia-clinica-id.vo.js';
import { PacienteId } from '../../../historias-clinicas/domain/value-objects/paciente-id.vo.js';
import { OdontologoId } from '../../../historias-clinicas/domain/value-objects/odontologo-id.vo.js';
import { ConsultaId } from '../../../consultas-odontologicas/domain/value-objects/consulta-id.vo.js';
import { EstadoAnatomicoPieza } from '../value-objects/estado-anatomico-pieza.enum.js';
import { EstadoEvaluacionPieza } from '../value-objects/estado-evaluacion-pieza.enum.js';
import { TipoSuperficie } from '../value-objects/tipo-superficie.enum.js';
import { CondicionSuperficie } from '../value-objects/condicion-superficie.enum.js';
import { TipoRevisionOdontograma } from '../value-objects/tipo-revision-odontograma.enum.js';
import { ConflictoConcurrenteOdontogramaError } from '../errors/conflicto-concurrente-odontograma.error.js';
import { EnmiendaCorrectivaInvalidaError } from '../errors/enmienda-correctiva-invalida.error.js';
import { SuperficieIncisalIncompatibleError } from '../errors/superficie-incisal-incompatible.error.js';
import { TipoTratamientoEstructural } from '../value-objects/tipo-tratamiento-estructural.enum.js';
import { TratamientoEstructural } from '../value-objects/tratamiento-estructural.vo.js';
import { DeltaPiezaOdontograma } from '../value-objects/delta-pieza-odontograma.vo.js';

describe('Odontograma (Aggregate Root)', () => {
  const historiaId = HistoriaClinicaId.reconstituir('hc_8af2ae02-5a6a-4bb0-8da1-1c9e23cff07a');
  const pacienteId = PacienteId.crear('pac_44445555-6666-7777-8888-999900001111');
  const odontologoId = OdontologoId.crear('od_henry_principal');
  const fechaFija = new Date('2026-10-25T10:00:00.000Z');

  describe('1. Inicialización Basal (INV-ODO-01)', () => {
    it('debe inicializar exactamente las 52 posiciones FDI en estado DESCONOCIDO y NO_EVALUADO', () => {
      const { odontograma, revisionBasal } = Odontograma.inicializar({
        historiaClinicaId: historiaId,
        pacienteId,
        odontologoId,
        ahora: fechaFija,
      });

      expect(odontograma.piezas.size).toBe(52);
      expect(odontograma.version).toBe(1);
      expect(odontograma.totalRevisiones).toBe(1);
      expect(odontograma.revisionActualId.equals(revisionBasal.id)).toBe(true);

      // Verificación de que ninguna pieza se asume SANA ni PRESENTE a priori
      for (const pieza of odontograma.piezas.values()) {
        expect(pieza.estadoAnatomico).toBe(EstadoAnatomicoPieza.DESCONOCIDO);
        expect(pieza.estadoEvaluacion).toBe(EstadoEvaluacionPieza.NO_EVALUADO);
        expect(pieza.observaciones).toBeNull();
        expect(pieza.tratamientosEstructurales.length).toBe(0);

        for (const sup of pieza.superficies.values()) {
          expect(sup.condicion).toBe(CondicionSuperficie.NO_EVALUADA);
          expect(sup.evaluada).toBe(false);
        }
      }

      // Verificación de la Revisión 1 basal generada
      expect(revisionBasal.numeroRevision).toBe(1);
      expect(revisionBasal.tipoRevision).toBe(TipoRevisionOdontograma.NUEVA_OBSERVACION);
      expect(revisionBasal.aplicaAlEstadoActual).toBe(true);
      expect(revisionBasal.consultaId).toBeNull();
      expect(revisionBasal.cambiosAplicados.length).toBe(0);
      expect(revisionBasal.snapshotPiezas.length).toBe(52);
    });

    it('no debe contener posiciones FDI anatómicamente inexistentes (ej. 19, 20, 29, 56)', () => {
      const { odontograma } = Odontograma.inicializar({
        historiaClinicaId: historiaId,
        pacienteId,
        odontologoId,
      });

      expect(odontograma.piezas.has(19)).toBe(false);
      expect(odontograma.piezas.has(20)).toBe(false);
      expect(odontograma.piezas.has(29)).toBe(false);
      expect(odontograma.piezas.has(56)).toBe(false);
      expect(odontograma.piezas.has(86)).toBe(false);

      // Sí contiene los 8 permanentes y 5 temporales por cuadrante
      expect(odontograma.piezas.has(11)).toBe(true);
      expect(odontograma.piezas.has(18)).toBe(true);
      expect(odontograma.piezas.has(51)).toBe(true);
      expect(odontograma.piezas.has(55)).toBe(true);
      expect(odontograma.piezas.has(85)).toBe(true);
    });
  });

  describe('2. Aplicación de Revisiones Clínicas y Concurrencia (INV-ODO-06)', () => {
    it('debe aplicar una nueva observación clínica incrementando versión y actualizando estado consolidado', () => {
      const { odontograma } = Odontograma.inicializar({
        historiaClinicaId: historiaId,
        pacienteId,
        odontologoId,
        ahora: fechaFija,
      });

      const consultaId = ConsultaId.generar();
      const nuevaRevision = odontograma.aplicarRevision({
        tipoRevision: TipoRevisionOdontograma.NUEVA_OBSERVACION,
        aplicaAlEstadoActual: true,
        consultaId,
        odontologoId,
        fechaObservacionClinica: new Date('2026-10-25T10:15:00.000Z'),
        motivoRevision: 'Examen clínico en sillón dental detecta caries oclusal',
        versionEsperada: 1,
        deltas: [
          {
            numeroFDI: 36,
            estadoAnatomicoNuevo: EstadoAnatomicoPieza.PRESENTE,
            superficiesModificadas: [
              {
                superficie: TipoSuperficie.OCLUSAL_INCISAL,
                condicionAnterior: CondicionSuperficie.NO_EVALUADA,
                condicionNueva: CondicionSuperficie.CARIES,
              },
            ],
            observaciones: 'Caries cavitada activa',
          },
        ],
      });

      expect(odontograma.version).toBe(2);
      expect(odontograma.totalRevisiones).toBe(2);
      expect(odontograma.revisionActualId.equals(nuevaRevision.id)).toBe(true);

      // La proyección activa de la pieza 36 ahora refleja PRESENTE y CARIES oclusal
      const pieza36 = odontograma.obtenerPieza(36);
      expect(pieza36.estadoAnatomico).toBe(EstadoAnatomicoPieza.PRESENTE);
      expect(pieza36.estadoEvaluacion).toBe(EstadoEvaluacionPieza.EVALUADO);
      expect(pieza36.superficies.get(TipoSuperficie.OCLUSAL_INCISAL)?.condicion).toBe(CondicionSuperficie.CARIES);
      expect(pieza36.observaciones).toBe('Caries cavitada activa');

      // Las demás piezas continúan en estado no evaluado
      const pieza37 = odontograma.obtenerPieza(37);
      expect(pieza37.estadoAnatomico).toBe(EstadoAnatomicoPieza.DESCONOCIDO);
      expect(pieza37.estadoEvaluacion).toBe(EstadoEvaluacionPieza.NO_EVALUADO);
    });

    it('debe rechazar la aplicación de una revisión si la versión esperada no coincide (INV-ODO-06)', () => {
      const { odontograma } = Odontograma.inicializar({
        historiaClinicaId: historiaId,
        pacienteId,
        odontologoId,
      });

      expect(() => {
        odontograma.aplicarRevision({
          tipoRevision: TipoRevisionOdontograma.NUEVA_OBSERVACION,
          aplicaAlEstadoActual: true,
          odontologoId,
          fechaObservacionClinica: new Date(),
          motivoRevision: 'Actualización con versión obsoleta',
          versionEsperada: 99, // Desfasada respecto a versión 1
          deltas: [],
        });
      }).toThrow(ConflictoConcurrenteOdontogramaError);

      // El odontograma no sufrió ninguna mutación en su versión ni piezas
      expect(odontograma.version).toBe(1);
      expect(odontograma.totalRevisiones).toBe(1);
    });

    it('debe permitir múltiples revisiones vinculadas a una misma consulta odontológica', () => {
      const { odontograma } = Odontograma.inicializar({
        historiaClinicaId: historiaId,
        pacienteId,
        odontologoId,
      });

      const mismaConsultaId = ConsultaId.generar();

      // Revisión 2: Registro de diagnóstico inicial en sillón
      const rev2 = odontograma.aplicarRevision({
        tipoRevision: TipoRevisionOdontograma.NUEVA_OBSERVACION,
        aplicaAlEstadoActual: true,
        consultaId: mismaConsultaId,
        odontologoId,
        fechaObservacionClinica: new Date(),
        motivoRevision: 'Inspección inicial: caries en pieza 16',
        versionEsperada: 1,
        deltas: [
          {
            numeroFDI: 16,
            estadoAnatomicoNuevo: EstadoAnatomicoPieza.PRESENTE,
            superficiesModificadas: [
              {
                superficie: TipoSuperficie.OCLUSAL_INCISAL,
                condicionAnterior: CondicionSuperficie.NO_EVALUADA,
                condicionNueva: CondicionSuperficie.CARIES,
              },
            ],
          },
        ],
      });

      // Revisión 3: Registro del tratamiento realizado al final de la misma consulta
      const rev3 = odontograma.aplicarRevision({
        tipoRevision: TipoRevisionOdontograma.NUEVA_OBSERVACION,
        aplicaAlEstadoActual: true,
        consultaId: mismaConsultaId,
        odontologoId,
        fechaObservacionClinica: new Date(),
        motivoRevision: 'Tratamiento completado: obturación con resina en pieza 16',
        versionEsperada: 2,
        deltas: [
          {
            numeroFDI: 16,
            superficiesModificadas: [
              {
                superficie: TipoSuperficie.OCLUSAL_INCISAL,
                condicionAnterior: CondicionSuperficie.CARIES,
                condicionNueva: CondicionSuperficie.OBTURACION_RESINA,
              },
            ],
          },
        ],
      });

      expect(odontograma.version).toBe(3);
      expect(odontograma.totalRevisiones).toBe(3);
      expect(rev2.consultaId?.equals(mismaConsultaId)).toBe(true);
      expect(rev3.consultaId?.equals(mismaConsultaId)).toBe(true);
      expect(rev2.numeroRevision).toBe(2);
      expect(rev3.numeroRevision).toBe(3);
      expect(odontograma.revisionActualId.equals(rev3.id)).toBe(true);
    });
  });

  describe('3. Enmiendas Correctivas Retrospectivas (INV-ODO-05)', () => {
    it('debe registrar una enmienda correctiva retrospectiva válida usando snapshotBaseRevisionCorregida sin alterar el presente', () => {
      const { odontograma, revisionBasal } = Odontograma.inicializar({
        historiaClinicaId: historiaId,
        pacienteId,
        odontologoId,
        ahora: fechaFija,
      });

      // 1. Aplicamos una segunda revisión que modifica el estado presente (pieza 16 presente con caries)
      const rev2 = odontograma.aplicarRevision({
        tipoRevision: TipoRevisionOdontograma.NUEVA_OBSERVACION,
        aplicaAlEstadoActual: true,
        odontologoId,
        fechaObservacionClinica: new Date('2026-10-25T11:00:00.000Z'),
        motivoRevision: 'Detección clínica de caries oclusal en molar 16',
        versionEsperada: 1,
        deltas: [
          {
            numeroFDI: 16,
            estadoAnatomicoNuevo: EstadoAnatomicoPieza.PRESENTE,
            superficiesModificadas: [
              {
                superficie: TipoSuperficie.OCLUSAL_INCISAL,
                condicionAnterior: CondicionSuperficie.NO_EVALUADA,
                condicionNueva: CondicionSuperficie.CARIES,
              },
            ],
          },
        ],
      });

      expect(odontograma.version).toBe(2);
      expect(odontograma.totalRevisiones).toBe(2);
      expect(odontograma.revisionActualId.equals(rev2.id)).toBe(true);

      // 2. Se emite una ENMIENDA_CORRECTIVA a la revisión basal (Rev 1) con aplicaAlEstadoActual = false,
      // para rectificar que en la inspección inicial la pieza 48 estaba AUSENTE en lugar de DESCONOCIDO.
      const enmienda = odontograma.aplicarRevision({
        tipoRevision: TipoRevisionOdontograma.ENMIENDA_CORRECTIVA,
        revisionCorregidaId: revisionBasal.id,
        aplicaAlEstadoActual: false,
        snapshotBaseRevisionCorregida: revisionBasal.snapshotPiezas,
        odontologoId,
        fechaObservacionClinica: new Date('2026-10-25T10:00:00.000Z'),
        motivoRevision: 'Rectificación de omisión en registro basal: molar 48 agenesia/ausente',
        versionEsperada: 2,
        deltas: [
          {
            numeroFDI: 48,
            estadoAnatomicoNuevo: EstadoAnatomicoPieza.AUSENTE,
          },
        ],
      });

      // Auditoría:
      // a) La enmienda referencia correctamente la revisión rectificada
      expect(enmienda.esEnmienda).toBe(true);
      expect(enmienda.revisionCorregidaId?.equals(revisionBasal.id)).toBe(true);
      expect(enmienda.aplicaAlEstadoActual).toBe(false);
      expect(enmienda.numeroRevision).toBe(3);

      // b) Se conserva intacta la revisión original basal
      const p48Basal = revisionBasal.snapshotPiezas.find((p) => p.numeroFDI === 48);
      expect(p48Basal?.estadoAnatomico).toBe(EstadoAnatomicoPieza.DESCONOCIDO);

      // c) El snapshot rectificado de la enmienda refleja la corrección sobre el pasado (p48 es AUSENTE),
      // pero NO incorpora las mutaciones posteriores del presente (p16 en la enmienda sigue siendo DESCONOCIDO)
      const p48Enmienda = enmienda.snapshotPiezas.find((p) => p.numeroFDI === 48);
      expect(p48Enmienda?.estadoAnatomico).toBe(EstadoAnatomicoPieza.AUSENTE);
      const p16Enmienda = enmienda.snapshotPiezas.find((p) => p.numeroFDI === 16);
      expect(p16Enmienda?.estadoAnatomico).toBe(EstadoAnatomicoPieza.DESCONOCIDO);

      // d) El estado vigente permanece completamente inalterado
      const p48Actual = odontograma.obtenerPieza(48);
      expect(p48Actual.estadoAnatomico).toBe(EstadoAnatomicoPieza.DESCONOCIDO); // NO mutó al aplicar la enmienda
      const p16Actual = odontograma.obtenerPieza(16);
      expect(p16Actual.estadoAnatomico).toBe(EstadoAnatomicoPieza.PRESENTE); // Conserva su estado activo
      expect(p16Actual.superficies.get(TipoSuperficie.OCLUSAL_INCISAL)?.condicion).toBe(CondicionSuperficie.CARIES);

      // e) No se altera el puntero de última revisión aplicada (sigue siendo rev2)
      expect(odontograma.revisionActualId.equals(rev2.id)).toBe(true);

      // f) La secuencia de revisiones y versión conserva su consistencia
      expect(odontograma.totalRevisiones).toBe(3);
      expect(odontograma.version).toBe(3);
    });

    it('debe rechazar enmiendas retrospectivas si no se proporciona snapshotBaseRevisionCorregida de 52 piezas', () => {
      const { odontograma, revisionBasal } = Odontograma.inicializar({
        historiaClinicaId: historiaId,
        pacienteId,
        odontologoId,
      });

      // Intento sin proveer snapshotBaseRevisionCorregida
      expect(() => {
        odontograma.aplicarRevision({
          tipoRevision: TipoRevisionOdontograma.ENMIENDA_CORRECTIVA,
          revisionCorregidaId: revisionBasal.id,
          aplicaAlEstadoActual: false,
          odontologoId,
          fechaObservacionClinica: new Date(),
          motivoRevision: 'Corrección histórica sin base de datos necesaria',
          versionEsperada: 1,
          deltas: [],
        });
      }).toThrow(EnmiendaCorrectivaInvalidaError);

      // Intento con array incompleto (menos de 52 piezas)
      expect(() => {
        odontograma.aplicarRevision({
          tipoRevision: TipoRevisionOdontograma.ENMIENDA_CORRECTIVA,
          revisionCorregidaId: revisionBasal.id,
          aplicaAlEstadoActual: false,
          snapshotBaseRevisionCorregida: revisionBasal.snapshotPiezas.slice(0, 50),
          odontologoId,
          fechaObservacionClinica: new Date(),
          motivoRevision: 'Corrección histórica con datos parciales inválidos',
          versionEsperada: 1,
          deltas: [],
        });
      }).toThrow(EnmiendaCorrectivaInvalidaError);
    });

    it('debe permitir una enmienda correctiva que SÍ aplica al estado actual (aplicaAlEstadoActual = true)', () => {
      const { odontograma, revisionBasal } = Odontograma.inicializar({
        historiaClinicaId: historiaId,
        pacienteId,
        odontologoId,
      });

      const enmiendaVigente = odontograma.aplicarRevision({
        tipoRevision: TipoRevisionOdontograma.ENMIENDA_CORRECTIVA,
        revisionCorregidaId: revisionBasal.id,
        aplicaAlEstadoActual: true,
        odontologoId,
        fechaObservacionClinica: new Date(),
        motivoRevision: 'Corrección con rectificación y efecto en estado vigente',
        versionEsperada: 1,
        deltas: [
          {
            numeroFDI: 24,
            estadoAnatomicoNuevo: EstadoAnatomicoPieza.PRESENTE,
          },
        ],
      });

      expect(odontograma.version).toBe(2);
      expect(odontograma.totalRevisiones).toBe(2);
      expect(odontograma.revisionActualId.equals(enmiendaVigente.id)).toBe(true);
      expect(odontograma.obtenerPieza(24).estadoAnatomico).toBe(EstadoAnatomicoPieza.PRESENTE);
    });

    it('debe rechazar enmiendas sin revisionCorregidaId o con justificación menor a 10 caracteres (INV-ODO-05)', () => {
      const { odontograma, revisionBasal } = Odontograma.inicializar({
        historiaClinicaId: historiaId,
        pacienteId,
        odontologoId,
      });

      // Sin revisionCorregidaId
      expect(() => {
        odontograma.aplicarRevision({
          tipoRevision: TipoRevisionOdontograma.ENMIENDA_CORRECTIVA,
          aplicaAlEstadoActual: false,
          snapshotBaseRevisionCorregida: revisionBasal.snapshotPiezas,
          odontologoId,
          fechaObservacionClinica: new Date(),
          motivoRevision: 'Justificación detallada válida de más de 10 caracteres',
          versionEsperada: 1,
          deltas: [],
        });
      }).toThrow(EnmiendaCorrectivaInvalidaError);

      // Con justificación demasiado corta (< 10 caracteres)
      expect(() => {
        odontograma.aplicarRevision({
          tipoRevision: TipoRevisionOdontograma.ENMIENDA_CORRECTIVA,
          revisionCorregidaId: revisionBasal.id,
          aplicaAlEstadoActual: false,
          snapshotBaseRevisionCorregida: revisionBasal.snapshotPiezas,
          odontologoId,
          fechaObservacionClinica: new Date(),
          motivoRevision: 'Error', // solo 5 chars
          versionEsperada: 1,
          deltas: [],
        });
      }).toThrow(EnmiendaCorrectivaInvalidaError);

      // Enmienda autorreferencial
      const nuevoId = RevisionId.generar();
      expect(() => {
        odontograma.aplicarRevision({
          revisionId: nuevoId,
          tipoRevision: TipoRevisionOdontograma.ENMIENDA_CORRECTIVA,
          revisionCorregidaId: nuevoId, // Se apunta a sí misma
          aplicaAlEstadoActual: false,
          snapshotBaseRevisionCorregida: revisionBasal.snapshotPiezas,
          odontologoId,
          fechaObservacionClinica: new Date(),
          motivoRevision: 'Justificación válida de enmienda',
          versionEsperada: 1,
          deltas: [],
        });
      }).toThrow(EnmiendaCorrectivaInvalidaError);
    });
  });

  describe('4. Prevención de Mutaciones Parciales, Inmutabilidad Profunda e Invariantes', () => {
    it('debe abortar limpiamente sin mutaciones parciales si el último de varios deltas es inválido (INV-ODO-04)', () => {
      const { odontograma } = Odontograma.inicializar({
        historiaClinicaId: historiaId,
        pacienteId,
        odontologoId,
      });

      // Aplicamos 3 deltas:
      // Delta 1: Válido (pieza 11 a PRESENTE)
      // Delta 2: Válido (pieza 13 a PRESENTE)
      // Delta 3: Inválido (sellante en superficie incisal de canino 13 anterior)
      expect(() => {
        odontograma.aplicarRevision({
          tipoRevision: TipoRevisionOdontograma.NUEVA_OBSERVACION,
          aplicaAlEstadoActual: true,
          odontologoId,
          fechaObservacionClinica: new Date(),
          motivoRevision: 'Evaluación múltiple con error anatómico en el último delta',
          versionEsperada: 1,
          deltas: [
            {
              numeroFDI: 11,
              estadoAnatomicoNuevo: EstadoAnatomicoPieza.PRESENTE,
            },
            {
              numeroFDI: 13,
              estadoAnatomicoNuevo: EstadoAnatomicoPieza.PRESENTE,
            },
            {
              numeroFDI: 13,
              superficiesModificadas: [
                {
                  superficie: TipoSuperficie.OCLUSAL_INCISAL,
                  condicionAnterior: CondicionSuperficie.NO_EVALUADA,
                  condicionNueva: CondicionSuperficie.SELLANTE, // Prohibido en borde incisal anterior (INV-ODO-04)
                },
              ],
            },
          ],
        });
      }).toThrow(SuperficieIncisalIncompatibleError);

      // Verificación de integridad: CERO mutaciones parciales en el agregado
      expect(odontograma.version).toBe(1);
      expect(odontograma.totalRevisiones).toBe(1);
      expect(odontograma.obtenerPieza(11).estadoAnatomico).toBe(EstadoAnatomicoPieza.DESCONOCIDO);
      expect(odontograma.obtenerPieza(13).estadoAnatomico).toBe(EstadoAnatomicoPieza.DESCONOCIDO);
    });

    it('debe garantizar inmutabilidad profunda: modificar getters no altera estructuras internas del agregado', () => {
      const { odontograma } = Odontograma.inicializar({
        historiaClinicaId: historiaId,
        pacienteId,
        odontologoId,
      });

      // a) Mutar el Map devuelto por el getter piezas
      const piezasExternas = odontograma.piezas as Map<number, unknown>;
      piezasExternas.clear();
      expect(odontograma.piezas.size).toBe(52); // El agregado sigue con sus 52 piezas

      // b) Mutar la pieza devuelta por obtenerPieza()
      const pieza11Copia = odontograma.obtenerPieza(11);
      pieza11Copia.actualizarEstadoAnatomico(EstadoAnatomicoPieza.PRESENTE);
      expect(odontograma.obtenerPieza(11).estadoAnatomico).toBe(EstadoAnatomicoPieza.DESCONOCIDO);

      // c) Mutar el Map de superficies devuelto por la pieza
      const superficiesPieza = pieza11Copia.superficies as Map<TipoSuperficie, unknown>;
      superficiesPieza.clear();
      expect(pieza11Copia.superficies.size).toBe(5);

      // d) Intentar mutar tratamientos estructurales
      expect(() => {
        (pieza11Copia.tratamientosEstructurales as any).push('hack');
      }).toThrow();
    });

    it('debe garantizar inmutabilidad profunda de revisiones y snapshots históricos congelados', () => {
      const { revisionBasal } = Odontograma.inicializar({
        historiaClinicaId: historiaId,
        pacienteId,
        odontologoId,
      });

      // a) La revisión es inmutable (Object.isFrozen)
      expect(Object.isFrozen(revisionBasal)).toBe(true);

      // b) Intentar mutar cambiosAplicados o snapshotPiezas lanza error en strict mode
      expect(() => {
        (revisionBasal.cambiosAplicados as any).push('hack');
      }).toThrow();

      expect(() => {
        (revisionBasal.snapshotPiezas as any).push('hack');
      }).toThrow();

      // c) Intentar mutar objetos anidados del snapshot (superficies o tratamientos)
      const primerSnapshot = revisionBasal.snapshotPiezas[0];
      expect(Object.isFrozen(primerSnapshot)).toBe(true);
      expect(Object.isFrozen(primerSnapshot.superficies)).toBe(true);
      expect(Object.isFrozen(primerSnapshot.tratamientosEstructurales)).toBe(true);

      expect(() => {
        (primerSnapshot.superficies[TipoSuperficie.OCLUSAL_INCISAL] as any).condicion = CondicionSuperficie.CARIES;
      }).toThrow();
    });

    it('debe verificar inmutabilidad en Value Objects: TratamientoEstructural, DeltaPieza y SuperficieDental', () => {
      const ahora = new Date();
      const tratamiento = TratamientoEstructural.crear(TipoTratamientoEstructural.CORONA, null, ahora);
      expect(Object.isFrozen(tratamiento)).toBe(true);
      expect(() => {
        (tratamiento as any)._tipo = TipoTratamientoEstructural.IMPLANTE;
      }).toThrow();

      const delta = new DeltaPiezaOdontograma({
        numeroFDI: 16,
        estadoAnatomicoNuevo: EstadoAnatomicoPieza.PRESENTE,
        superficiesModificadas: [
          {
            superficie: TipoSuperficie.MESIAL,
            condicionAnterior: CondicionSuperficie.NO_EVALUADA,
            condicionNueva: CondicionSuperficie.SANA,
          },
        ],
      });
      expect(Object.isFrozen(delta)).toBe(true);
      expect(Object.isFrozen(delta.superficiesModificadas)).toBe(true);
      expect(Object.isFrozen(delta.superficiesModificadas[0])).toBe(true);
      expect(() => {
        (delta.superficiesModificadas[0] as any).condicionNueva = CondicionSuperficie.CARIES;
      }).toThrow();
    });

    it('debe proteger fechas mediante copias defensivas bidireccionales', () => {
      const fechaMutable = new Date('2026-10-25T12:00:00.000Z');
      const { odontograma, revisionBasal } = Odontograma.inicializar({
        historiaClinicaId: historiaId,
        pacienteId,
        odontologoId,
        ahora: fechaMutable,
      });

      fechaMutable.setFullYear(2035);
      expect(odontograma.creadoEn.getFullYear()).toBe(2026);
      expect(revisionBasal.fechaRegistro.getFullYear()).toBe(2026);

      // Modificar fecha obtenida por getter tampoco debe mutar el agregado
      const fechaObtenida = odontograma.creadoEn;
      fechaObtenida.setFullYear(2040);
      expect(odontograma.creadoEn.getFullYear()).toBe(2026);
    });

    it('debe reconstituir el agregado conservando todas sus invariantes', () => {
      const { odontograma } = Odontograma.inicializar({
        historiaClinicaId: historiaId,
        pacienteId,
        odontologoId,
      });

      const piezasCopia = new Map(odontograma.piezas);
      const reconstituido = Odontograma.reconstituir({
        id: odontograma.id,
        historiaClinicaId: odontograma.historiaClinicaId,
        pacienteId: odontograma.pacienteId,
        piezas: piezasCopia,
        revisionActualId: odontograma.revisionActualId,
        totalRevisiones: odontograma.totalRevisiones,
        version: odontograma.version,
        creadoEn: odontograma.creadoEn,
        actualizadoEn: odontograma.actualizadoEn,
        actualizadoPor: odontograma.actualizadoPor,
      });

      expect(reconstituido.id.equals(odontograma.id)).toBe(true);
      expect(reconstituido.piezas.size).toBe(52);
      expect(reconstituido.version).toBe(1);
    });
  });
});
