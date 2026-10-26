import { describe, it, expect } from 'vitest';
import { OdontogramaMongoMapper } from './odontograma-mongo.mapper.js';
import { Odontograma } from '../../../../domain/entities/odontograma.entity.js';
import { HistoriaClinicaId } from '../../../../../historias-clinicas/domain/value-objects/historia-clinica-id.vo.js';
import { PacienteId } from '../../../../../historias-clinicas/domain/value-objects/paciente-id.vo.js';
import { OdontologoId } from '../../../../../historias-clinicas/domain/value-objects/odontologo-id.vo.js';
import { EstadoAnatomicoPieza } from '../../../../domain/value-objects/estado-anatomico-pieza.enum.js';
import { EstadoEvaluacionPieza } from '../../../../domain/value-objects/estado-evaluacion-pieza.enum.js';
import { TipoSuperficie } from '../../../../domain/value-objects/tipo-superficie.enum.js';
import { CondicionSuperficie } from '../../../../domain/value-objects/condicion-superficie.enum.js';
import { TipoTratamientoEstructural } from '../../../../domain/value-objects/tipo-tratamiento-estructural.enum.js';
import { TipoRevisionOdontograma } from '../../../../domain/value-objects/tipo-revision-odontograma.enum.js';

describe('OdontogramaMongoMapper', () => {
  const historiaId = HistoriaClinicaId.reconstituir('hc_12345678-1234-1234-1234-123456789abc');
  const pacienteId = PacienteId.crear('pac_87654321-4321-4321-4321-abcdef123456');
  const odontologoId = OdontologoId.crear('od_henry_principal');
  const fechaFija = new Date('2026-10-25T10:00:00.000Z');

  it('1. debe mapear correctamente un Odontograma inicial a documento de persistencia con 52 posiciones', () => {
    const { odontograma } = Odontograma.inicializar({
      historiaClinicaId: historiaId,
      pacienteId,
      odontologoId,
      ahora: fechaFija,
    });

    const doc = OdontogramaMongoMapper.odontogramaToPersistence(odontograma);

    expect(doc._id).toBe(odontograma.id.valor);
    expect(doc.historiaClinicaId).toBe(historiaId.valor);
    expect(doc.pacienteId).toBe(pacienteId.valor);
    expect(doc.version).toBe(1);
    expect(doc.totalRevisiones).toBe(1);
    expect(doc.piezas.length).toBe(52);
    expect(doc.revisionActualId).toBe(odontograma.revisionActualId.valor);
    expect(doc.creadoEn.toISOString()).toBe(fechaFija.toISOString());
    expect(doc.actualizadoEn.toISOString()).toBe(fechaFija.toISOString());
    expect(doc.actualizadoPor).toBe(odontologoId.valor);
  });

  it('2. debe conservar estados DESCONOCIDO y superficies NO_EVALUADA en persistencia', () => {
    const { odontograma } = Odontograma.inicializar({
      historiaClinicaId: historiaId,
      pacienteId,
      odontologoId,
    });

    const doc = OdontogramaMongoMapper.odontogramaToPersistence(odontograma);
    const primerDiente = doc.piezas[0];

    expect(primerDiente.estadoAnatomico).toBe(EstadoAnatomicoPieza.DESCONOCIDO);
    expect(primerDiente.estadoEvaluacion).toBe(EstadoEvaluacionPieza.NO_EVALUADO);
    expect(primerDiente.superficies.size).toBe(5);

    const vestibular = primerDiente.superficies.get(TipoSuperficie.VESTIBULAR);
    expect(vestibular?.condicion).toBe(CondicionSuperficie.NO_EVALUADA);
    expect(vestibular?.evaluada).toBe(false);
  });

  it('3. debe mapear y reconstituir el agregado conservando todas sus invariantes de dominio', () => {
    const { odontograma } = Odontograma.inicializar({
      historiaClinicaId: historiaId,
      pacienteId,
      odontologoId,
      ahora: fechaFija,
    });

    // Modificamos una pieza con condición y tratamiento
    odontograma.aplicarRevision({
      tipoRevision: TipoRevisionOdontograma.NUEVA_OBSERVACION,
      aplicaAlEstadoActual: true,
      odontologoId,
      fechaObservacionClinica: fechaFija,
      motivoRevision: 'Registro de molar con caries y tratamiento',
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
          tratamientoEstructuralAgregado: TipoTratamientoEstructural.CORONA,
        },
      ],
      ahora: fechaFija,
    });

    const doc = OdontogramaMongoMapper.odontogramaToPersistence(odontograma);
    const reconstituido = OdontogramaMongoMapper.odontogramaToDomain(doc);

    expect(reconstituido.id.valor).toBe(odontograma.id.valor);
    expect(reconstituido.version).toBe(2);
    expect(reconstituido.totalRevisiones).toBe(2);
    expect(reconstituido.piezas.size).toBe(52);

    const pieza16 = reconstituido.obtenerPieza(16);
    expect(pieza16.estadoAnatomico).toBe(EstadoAnatomicoPieza.PRESENTE);
    expect(pieza16.estadoEvaluacion).toBe(EstadoEvaluacionPieza.EVALUADO);
    expect(pieza16.superficies.get(TipoSuperficie.OCLUSAL_INCISAL)?.condicion).toBe(CondicionSuperficie.CARIES);
    expect(pieza16.tratamientosEstructurales.length).toBe(1);
    expect(pieza16.tratamientosEstructurales[0].tipo).toBe(TipoTratamientoEstructural.CORONA);
  });

  it('4. debe rechazar la reconstitución si el documento no contiene exactamente 52 piezas FDI', () => {
    const { odontograma } = Odontograma.inicializar({
      historiaClinicaId: historiaId,
      pacienteId,
      odontologoId,
    });

    const doc = OdontogramaMongoMapper.odontogramaToPersistence(odontograma);
    doc.piezas = doc.piezas.slice(0, 50); // documento corrupto con 50 piezas

    expect(() => OdontogramaMongoMapper.odontogramaToDomain(doc)).toThrow(
      /debe contener exactamente 52 posiciones FDI/
    );
  });

  it('5. debe mapear y reconstituir una RevisionOdontograma basal con deltas y snapshot de 52 piezas', () => {
    const { revisionBasal } = Odontograma.inicializar({
      historiaClinicaId: historiaId,
      pacienteId,
      odontologoId,
      ahora: fechaFija,
    });

    const doc = OdontogramaMongoMapper.revisionToPersistence(revisionBasal);

    expect(doc._id).toBe(revisionBasal.id.valor);
    expect(doc.odontogramaId).toBe(revisionBasal.odontogramaId.valor);
    expect(doc.numeroRevision).toBe(1);
    expect(doc.tipoRevision).toBe(TipoRevisionOdontograma.NUEVA_OBSERVACION);
    expect(doc.snapshotPiezas.length).toBe(52);
    expect(doc.cambiosAplicados.length).toBe(0);

    const reconstituida = OdontogramaMongoMapper.revisionToDomain(doc);
    expect(reconstituida.id.valor).toBe(revisionBasal.id.valor);
    expect(reconstituida.numeroRevision).toBe(1);
    expect(reconstituida.snapshotPiezas.length).toBe(52);
  });

  it('6. debe mapear y reconstituir una ENMIENDA_CORRECTIVA retrospectiva con referencia de corrección', () => {
    const { odontograma, revisionBasal } = Odontograma.inicializar({
      historiaClinicaId: historiaId,
      pacienteId,
      odontologoId,
    });

    const enmienda = odontograma.aplicarRevision({
      tipoRevision: TipoRevisionOdontograma.ENMIENDA_CORRECTIVA,
      revisionCorregidaId: revisionBasal.id,
      aplicaAlEstadoActual: false,
      snapshotBaseRevisionCorregida: revisionBasal.snapshotPiezas,
      odontologoId,
      fechaObservacionClinica: fechaFija,
      motivoRevision: 'Rectificación de diagnóstico histórico sin alterar el presente',
      versionEsperada: 1,
      deltas: [
        {
          numeroFDI: 48,
          estadoAnatomicoNuevo: EstadoAnatomicoPieza.AUSENTE,
        },
      ],
      ahora: fechaFija,
    });

    const doc = OdontogramaMongoMapper.revisionToPersistence(enmienda);
    expect(doc.tipoRevision).toBe(TipoRevisionOdontograma.ENMIENDA_CORRECTIVA);
    expect(doc.revisionCorregidaId).toBe(revisionBasal.id.valor);
    expect(doc.aplicaAlEstadoActual).toBe(false);

    const reconstituida = OdontogramaMongoMapper.revisionToDomain(doc);
    expect(reconstituida.id.valor).toBe(enmienda.id.valor);
    expect(reconstituida.revisionCorregidaId?.valor).toBe(revisionBasal.id.valor);
    expect(reconstituida.aplicaAlEstadoActual).toBe(false);
    expect(reconstituida.snapshotPiezas.length).toBe(52);
  });
});
