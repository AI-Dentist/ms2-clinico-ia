import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { randomUUID } from 'node:crypto';
import net from 'node:net';
import mongoose, { Connection, Model } from 'mongoose';
import { MongoOdontogramaRepository } from './mongo-odontograma.repository.js';

function isPortReachable(port: number, timeoutMs = 800): Promise<boolean> {
  return new Promise((resolve) => {
    const socket = new net.Socket();
    socket.setTimeout(timeoutMs);
    socket.once('connect', () => {
      socket.destroy();
      resolve(true);
    });
    socket.once('error', () => {
      socket.destroy();
      resolve(false);
    });
    socket.once('timeout', () => {
      socket.destroy();
      resolve(false);
    });
    socket.connect(port, '127.0.0.1');
  });
}
import {
  OdontogramaDocument,
  OdontogramaSchema,
} from '../schemas/odontograma.schema.js';
import {
  RevisionOdontogramaDocument,
  RevisionOdontogramaSchema,
} from '../schemas/revision-odontograma.schema.js';
import { Odontograma } from '../../../../domain/entities/odontograma.entity.js';
import { HistoriaClinicaId } from '../../../../../historias-clinicas/domain/value-objects/historia-clinica-id.vo.js';
import { PacienteId } from '../../../../../historias-clinicas/domain/value-objects/paciente-id.vo.js';
import { OdontologoId } from '../../../../../historias-clinicas/domain/value-objects/odontologo-id.vo.js';
import { ConsultaId } from '../../../../../consultas-odontologicas/domain/value-objects/consulta-id.vo.js';
import { TipoRevisionOdontograma } from '../../../../domain/value-objects/tipo-revision-odontograma.enum.js';
import { EstadoAnatomicoPieza } from '../../../../domain/value-objects/estado-anatomico-pieza.enum.js';
import { EstadoEvaluacionPieza } from '../../../../domain/value-objects/estado-evaluacion-pieza.enum.js';
import { TipoSuperficie } from '../../../../domain/value-objects/tipo-superficie.enum.js';
import { CondicionSuperficie } from '../../../../domain/value-objects/condicion-superficie.enum.js';
import { TipoTratamientoEstructural } from '../../../../domain/value-objects/tipo-tratamiento-estructural.enum.js';
import { ConflictoConcurrenteOdontogramaError } from '../../../../domain/errors/conflicto-concurrente-odontograma.error.js';
import { OdontogramaDuplicadoError } from '../../../../domain/errors/odontograma-duplicado.error.js';

describe('MongoOdontogramaRepository (Real Integration Tests on Isolated Replica Set)', () => {
  let connection: Connection;
  let odontogramaModel: Model<OdontogramaDocument>;
  let revisionModel: Model<RevisionOdontogramaDocument>;
  let repository: MongoOdontogramaRepository;
  let testDbName: string;

  const historiaId = HistoriaClinicaId.reconstituir('hc_12345678-1234-1234-1234-123456789abc');
  const pacienteId = PacienteId.crear('pac_87654321-4321-4321-4321-abcdef123456');
  const odontologoId = OdontologoId.crear('od_henry_principal');
  const fechaFija = new Date('2026-10-25T10:00:00.000Z');

  beforeAll(async () => {
    const isAvailable = await isPortReachable(27018);
    if (!isAvailable) {
      console.warn('Servidor replica set de pruebas en puerto 27018 no activo. Omitiendo suite de integración real.');
      return;
    }

    // 1. Base de datos temporal única y aislada
    testDbName = `test-odontogramas-int-${randomUUID()}`;

    // SALVAGUARDAS ESTRICTAS DE AISLAMIENTO
    if (
      testDbName === 'clinica-dentalDB' ||
      testDbName.includes('clinica-dentalDB') ||
      testDbName === 'admin' ||
      testDbName === 'local'
    ) {
      throw new Error('CRÍTICO: Salvaguarda violada. No se permite ejecutar sobre bases no autorizadas.');
    }

    const testMongoUri = `mongodb://127.0.0.1:27018/${testDbName}?replicaSet=rs_odontograma_test`;
    connection = await mongoose.createConnection(testMongoUri).asPromise();

    // Verificación de host, puerto y base temporal
    const activePort = connection.port;
    const activeDbName = connection.db?.databaseName;

    if (activePort !== 27018) {
      await connection.close();
      throw new Error(`CRÍTICO: La conexión de integración debe apuntar al puerto 27018 (recibido: ${activePort})`);
    }

    if (!activeDbName || !activeDbName.startsWith('test-odontogramas-int-')) {
      await connection.close();
      throw new Error(`CRÍTICO: La base de datos activa no tiene el prefijo aislado seguro (recibido: ${activeDbName})`);
    }

    odontogramaModel = connection.model(OdontogramaDocument.name, OdontogramaSchema);
    revisionModel = connection.model(RevisionOdontogramaDocument.name, RevisionOdontogramaSchema);

    // Asegurar índices en la base temporal de pruebas
    await Promise.all([
      odontogramaModel.createIndexes(),
      revisionModel.createIndexes(),
    ]);

    repository = new MongoOdontogramaRepository(odontogramaModel, revisionModel, connection);
  }, 30000);

  afterAll(async () => {
    if (connection) {
      const activePort = connection.port;
      const activeDbName = connection.db?.databaseName;

      // Limpieza segura: únicamente si estamos en puerto 27018 y con el prefijo UUID exacto
      if (activePort === 27018 && activeDbName?.startsWith('test-odontogramas-int-')) {
        await connection.dropDatabase();
      }
      await connection.close();
    }
  }, 30000);

  beforeEach((context) => {
    if (!repository) {
      context.skip();
    }
  });

  // ─── A. INICIALIZACIÓN TRANSACCIONAL ─────────────────────────────────────────

  describe('A. Inicialización Transaccional', () => {
    it('debe persistir atómicamente odontograma y revisión basal número 1 en una sola transacción', async () => {
      const { odontograma, revisionBasal } = Odontograma.inicializar({
        historiaClinicaId: historiaId,
        pacienteId,
        odontologoId,
        ahora: fechaFija,
      });

      await repository.guardarInicial(odontograma, revisionBasal);

      // Verificar persistencia de ambos documentos en sus respectivas colecciones
      const oDoc = await odontogramaModel.findById(odontograma.id.valor).lean().exec();
      const rDoc = await revisionModel.findById(revisionBasal.id.valor).lean().exec();

      expect(oDoc).toBeDefined();
      expect(rDoc).toBeDefined();

      // Verificar integridad estructural del odontograma
      expect(oDoc?._id).toBe(odontograma.id.valor);
      expect(oDoc?.historiaClinicaId).toBe(historiaId.valor);
      expect(oDoc?.pacienteId).toBe(pacienteId.valor);
      expect(oDoc?.version).toBe(1);
      expect(oDoc?.totalRevisiones).toBe(1);
      expect(oDoc?.revisionActualId).toBe(revisionBasal.id.valor);
      // Verificar que las 52 posiciones se inicialicen en DESCONOCIDO y NO_EVALUADO (nunca SANA)
      expect(oDoc?.piezas.length).toBe(52);
      for (const p of oDoc!.piezas) {
        expect(p.estadoAnatomico).toBe(EstadoAnatomicoPieza.DESCONOCIDO);
        expect(p.estadoEvaluacion).toBe(EstadoEvaluacionPieza.NO_EVALUADO);
        expect(p.tratamientosEstructurales.length).toBe(0);
        expect(p.observaciones).toBeNull();
        // Verificar que ninguna superficie esté como SANA
        const superficiesList = Object.values(p.superficies);
        expect(superficiesList.length).toBe(5);
        for (const s of superficiesList) {
          expect(s.condicion).toBe(CondicionSuperficie.NO_EVALUADA);
          expect(s.evaluada).toBe(false);
          expect(s.condicion).not.toBe('sana');
        }
      }

      // Verificar revisión basal
      expect(rDoc?.numeroRevision).toBe(1);
      expect(rDoc?.tipoRevision).toBe(TipoRevisionOdontograma.NUEVA_OBSERVACION);
      expect(rDoc?.snapshotPiezas.length).toBe(52);
      expect(rDoc?.cambiosAplicados.length).toBe(0);
    });

    it('debe impedir guardar dos odontogramas para la misma historia clínica (INV-ODO-01)', async () => {
      const otroPaciente = PacienteId.crear('pac_otro_paciente_002');
      const { odontograma, revisionBasal } = Odontograma.inicializar({
        historiaClinicaId: historiaId, // Misma historia clínica ya registrada
        pacienteId: otroPaciente,
        odontologoId,
        ahora: fechaFija,
      });

      await expect(
        repository.guardarInicial(odontograma, revisionBasal)
      ).rejects.toThrow(OdontogramaDuplicadoError);
    });
  });

  // ─── B. NUEVA OBSERVACIÓN ───────────────────────────────────────────────────

  describe('B. Nueva Observación Transaccional', () => {
    it('debe registrar nueva revisión, actualizar proyección y elevar versión concurrentemente', async () => {
      const odontograma = await repository.buscarPorHistoriaClinicaId(historiaId);
      expect(odontograma).not.toBeNull();
      if (!odontograma) return;

      const nuevaRevision = odontograma.aplicarRevision({
        tipoRevision: TipoRevisionOdontograma.NUEVA_OBSERVACION,
        aplicaAlEstadoActual: true,
        odontologoId,
        fechaObservacionClinica: fechaFija,
        motivoRevision: 'Registro de caries oclusal en pieza 16',
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
        ahora: fechaFija,
      });

      await repository.aplicarRevisionTransaccional(odontograma, nuevaRevision, 1);

      // Verificar en base de datos
      const oDoc = await odontogramaModel.findById(odontograma.id.valor).lean().exec();
      const rDoc = await revisionModel.findById(nuevaRevision.id.valor).lean().exec();

      expect(oDoc?.version).toBe(2);
      expect(oDoc?.totalRevisiones).toBe(2);
      expect(oDoc?.revisionActualId).toBe(nuevaRevision.id.valor);

      const pieza16 = oDoc?.piezas.find((p) => p.numeroFDI === 16);
      expect(pieza16?.estadoAnatomico).toBe(EstadoAnatomicoPieza.PRESENTE);
      expect(pieza16?.estadoEvaluacion).toBe(EstadoEvaluacionPieza.EVALUADO);

      // Verificar revisión inmutable
      expect(rDoc?.numeroRevision).toBe(2);
      expect(rDoc?.cambiosAplicados.length).toBe(1);
      expect(rDoc?.snapshotPiezas.length).toBe(52);
    });
  });

  // ─── C. ROLLBACK REAL ───────────────────────────────────────────────────────

  describe('C. Rollback Transaccional Real', () => {
    it('debe abortar la transacción ante error y garantizar cero escrituras parciales o huérfanas', async () => {
      const odontograma = await repository.buscarPorHistoriaClinicaId(historiaId);
      expect(odontograma).not.toBeNull();
      if (!odontograma) return;

      const revisionInvalida = odontograma.aplicarRevision({
        tipoRevision: TipoRevisionOdontograma.NUEVA_OBSERVACION,
        aplicaAlEstadoActual: true,
        odontologoId,
        fechaObservacionClinica: fechaFija,
        motivoRevision: 'Revisión destinada a fallar por error inesperado',
        versionEsperada: 2,
        deltas: [
          {
            numeroFDI: 21,
            estadoAnatomicoNuevo: EstadoAnatomicoPieza.PRESENTE,
          },
        ],
        ahora: fechaFija,
      });

      // Provocamos un fallo forzado creando un conflicto en la transacción:
      // Simulamos que el método updateOne falle (por ejemplo pasando versionEsperada desfasada)
      await expect(
        repository.aplicarRevisionTransaccional(odontograma, revisionInvalida, 999) // Versión inexistente
      ).rejects.toThrow(ConflictoConcurrenteOdontogramaError);

      // Verificaciones críticas de Rollback real:
      // 1. La revisión NUNCA debió persistir
      const revEnDb = await revisionModel.findById(revisionInvalida.id.valor).exec();
      expect(revEnDb).toBeNull();

      // 2. El odontograma debe conservar exactamente su estado y versión anteriores (versión 2)
      const oDoc = await odontogramaModel.findById(odontograma.id.valor).lean().exec();
      expect(oDoc?.version).toBe(2);
      expect(oDoc?.totalRevisiones).toBe(2);

      const pieza21 = oDoc?.piezas.find((p) => p.numeroFDI === 21);
      expect(pieza21?.estadoAnatomico).toBe(EstadoAnatomicoPieza.DESCONOCIDO); // No mutó
    });
  });

  // ─── D. CONCURRENCIA OPTIMISTA REAL ─────────────────────────────────────────

  describe('D. Concurrencia Optimista Real', () => {
    it('ante dos modificaciones concurrentes con la misma versionEsperada, solo una debe confirmarse y la otra abortar', async () => {
      const odontograma1 = await repository.buscarPorHistoriaClinicaId(historiaId);
      const odontograma2 = await repository.buscarPorHistoriaClinicaId(historiaId);
      expect(odontograma1).not.toBeNull();
      expect(odontograma2).not.toBeNull();
      if (!odontograma1 || !odontograma2) return;

      expect(odontograma1.version).toBe(2);
      expect(odontograma2.version).toBe(2);

      // Mutación A
      const revA = odontograma1.aplicarRevision({
        tipoRevision: TipoRevisionOdontograma.NUEVA_OBSERVACION,
        aplicaAlEstadoActual: true,
        odontologoId,
        fechaObservacionClinica: fechaFija,
        motivoRevision: 'Concurrente Operación A',
        versionEsperada: 2,
        deltas: [{ numeroFDI: 11, estadoAnatomicoNuevo: EstadoAnatomicoPieza.PRESENTE }],
      });

      // Mutación B
      const revB = odontograma2.aplicarRevision({
        tipoRevision: TipoRevisionOdontograma.NUEVA_OBSERVACION,
        aplicaAlEstadoActual: true,
        odontologoId,
        fechaObservacionClinica: fechaFija,
        motivoRevision: 'Concurrente Operación B',
        versionEsperada: 2,
        deltas: [{ numeroFDI: 12, estadoAnatomicoNuevo: EstadoAnatomicoPieza.PRESENTE }],
      });

      // Ejecución paralela
      const resultados = await Promise.allSettled([
        repository.aplicarRevisionTransaccional(odontograma1, revA, 2),
        repository.aplicarRevisionTransaccional(odontograma2, revB, 2),
      ]);

      const fulFilled = resultados.filter((r) => r.status === 'fulfilled');
      const rejected = resultados.filter((r) => r.status === 'rejected');

      expect(fulFilled.length).toBe(1);
      expect(rejected.length).toBe(1);

      // La operación rechazada debe contener ConflictoConcurrenteOdontogramaError
      const error = (rejected[0] as PromiseRejectedResult).reason;
      expect(error).toBeInstanceOf(ConflictoConcurrenteOdontogramaError);

      // Verificar consistencia histórica en MongoDB
      const oDoc = await odontogramaModel.findById(odontograma1.id.valor).lean().exec();
      expect(oDoc?.version).toBe(3);
      expect(oDoc?.totalRevisiones).toBe(3);

      // En la colección de revisiones debe haber exactamente 3 revisiones (1 basal, 2 previa, 3 ganadora)
      const totalRevisionesEnDb = await revisionModel.countDocuments({
        odontogramaId: odontograma1.id.valor,
      });
      expect(totalRevisionesEnDb).toBe(3);
    });
  });

  // ─── E. ENMIENDAS HISTÓRICAS RETROSPECTIVAS ─────────────────────────────────

  describe('E. Enmiendas Históricas Retrospectivas', () => {
    it('debe registrar ENMIENDA_CORRECTIVA con aplicaAlEstadoActual=false sin alterar el estado clínico vigente', async () => {
      const odontograma = await repository.buscarPorHistoriaClinicaId(historiaId);
      expect(odontograma).not.toBeNull();
      if (!odontograma) return;

      const versionActual = odontograma.version; // versión 3
      const revisiones = await repository.listarRevisiones(odontograma.id, 10, 0);
      const revisionBasal = revisiones.revisiones.find((r) => r.numeroRevision === 1);
      expect(revisionBasal).toBeDefined();
      if (!revisionBasal) return;

      // Estado clínico antes de la enmienda para pieza 48
      const pieza48Antes = odontograma.obtenerPieza(48);
      expect(pieza48Antes.estadoAnatomico).toBe(EstadoAnatomicoPieza.DESCONOCIDO);

      const enmienda = odontograma.aplicarRevision({
        tipoRevision: TipoRevisionOdontograma.ENMIENDA_CORRECTIVA,
        revisionCorregidaId: revisionBasal.id,
        aplicaAlEstadoActual: false,
        snapshotBaseRevisionCorregida: revisionBasal.snapshotPiezas,
        odontologoId,
        fechaObservacionClinica: fechaFija,
        motivoRevision: 'Rectificación de observación histórica inicial',
        versionEsperada: versionActual,
        deltas: [
          {
            numeroFDI: 48,
            estadoAnatomicoNuevo: EstadoAnatomicoPieza.AUSENTE,
          },
        ],
        ahora: fechaFija,
      });

      await repository.aplicarRevisionTransaccional(odontograma, enmienda, versionActual);

      // Comprobaciones en MongoDB:
      const oDoc = await odontogramaModel.findById(odontograma.id.valor).lean().exec();
      const rDoc = await revisionModel.findById(enmienda.id.valor).lean().exec();

      // 1. La enmienda quedó registrada con sus metadatos
      expect(rDoc?.tipoRevision).toBe(TipoRevisionOdontograma.ENMIENDA_CORRECTIVA);
      expect(rDoc?.revisionCorregidaId).toBe(revisionBasal.id.valor);
      expect(rDoc?.aplicaAlEstadoActual).toBe(false);

      // 2. El snapshot corregido de la enmienda tiene la corrección histórica
      const p48SnapshotEnmienda = rDoc?.snapshotPiezas.find((p) => p.numeroFDI === 48);
      expect(p48SnapshotEnmienda?.estadoAnatomico).toBe(EstadoAnatomicoPieza.AUSENTE);

      // 3. El estado clínico maestro vigente NO debe haber sido alterado
      const p48Maestro = oDoc?.piezas.find((p) => p.numeroFDI === 48);
      expect(p48Maestro?.estadoAnatomico).toBe(EstadoAnatomicoPieza.DESCONOCIDO);

      // 4. Los metadatos de versión y totalRevisiones sí debieron avanzar
      expect(oDoc?.version).toBe(versionActual + 1);
      expect(oDoc?.totalRevisiones).toBe(4);
    });
  });

  // ─── F. CONSULTAS HISTÓRICAS Y PAGINACIÓN ───────────────────────────────────

  describe('F. Consultas Históricas y Paginación', () => {
    it('debe listar revisiones paginadas en orden cronológico descendente', async () => {
      const odontograma = await repository.buscarPorHistoriaClinicaId(historiaId);
      expect(odontograma).not.toBeNull();
      if (!odontograma) return;

      const pagina1 = await repository.listarRevisiones(odontograma.id, 2, 0);
      expect(pagina1.total).toBe(4);
      expect(pagina1.revisiones.length).toBe(2);
      expect(pagina1.revisiones[0].numeroRevision).toBe(4);
      expect(pagina1.revisiones[1].numeroRevision).toBe(3);

      const pagina2 = await repository.listarRevisiones(odontograma.id, 2, 2);
      expect(pagina2.revisiones.length).toBe(2);
      expect(pagina2.revisiones[0].numeroRevision).toBe(2);
      expect(pagina2.revisiones[1].numeroRevision).toBe(1);
    });

    it('debe permitir asociar y listar múltiples revisiones por consultaId', async () => {
      const odontograma = await repository.buscarPorHistoriaClinicaId(historiaId);
      expect(odontograma).not.toBeNull();
      if (!odontograma) return;

      const consultaId = ConsultaId.generar();
      const versionActual = odontograma.version;

      const rev1Consulta = odontograma.aplicarRevision({
        tipoRevision: TipoRevisionOdontograma.NUEVA_OBSERVACION,
        consultaId,
        aplicaAlEstadoActual: true,
        odontologoId,
        fechaObservacionClinica: new Date('2026-10-25T11:00:00.000Z'),
        motivoRevision: 'Primera observación en la misma consulta',
        versionEsperada: versionActual,
        deltas: [{ numeroFDI: 31, estadoAnatomicoNuevo: EstadoAnatomicoPieza.PRESENTE }],
      });

      await repository.aplicarRevisionTransaccional(odontograma, rev1Consulta, versionActual);

      const rev2Consulta = odontograma.aplicarRevision({
        tipoRevision: TipoRevisionOdontograma.NUEVA_OBSERVACION,
        consultaId,
        aplicaAlEstadoActual: true,
        odontologoId,
        fechaObservacionClinica: new Date('2026-10-25T11:30:00.000Z'),
        motivoRevision: 'Segunda observación en la misma consulta',
        versionEsperada: versionActual + 1,
        deltas: [
          {
            numeroFDI: 31,
            tratamientoEstructuralAgregado: TipoTratamientoEstructural.CORONA,
          },
        ],
      });

      await repository.aplicarRevisionTransaccional(odontograma, rev2Consulta, versionActual + 1);

      // Listar revisiones vinculadas a la consulta
      const revisionesConsulta = await repository.listarRevisionesPorConsultaId(consultaId);

      expect(revisionesConsulta.length).toBe(2);
      expect(revisionesConsulta[0].id.valor).toBe(rev1Consulta.id.valor);
      expect(revisionesConsulta[1].id.valor).toBe(rev2Consulta.id.valor);
      expect(revisionesConsulta[0].numeroRevision).toBe(5);
      expect(revisionesConsulta[1].numeroRevision).toBe(6);
    });

    it('debe reconstituir fielmente el agregado completo desde la base de datos real', async () => {
      const odontograma = await repository.buscarPorHistoriaClinicaId(historiaId);
      expect(odontograma).not.toBeNull();
      if (!odontograma) return;

      expect(odontograma.piezas.size).toBe(52);
      expect(odontograma.version).toBe(6);
      expect(odontograma.totalRevisiones).toBe(6);

      const pieza31 = odontograma.obtenerPieza(31);
      expect(pieza31.estadoAnatomico).toBe(EstadoAnatomicoPieza.PRESENTE);
      expect(pieza31.tratamientosEstructurales.length).toBe(1);
      expect(pieza31.tratamientosEstructurales[0].tipo).toBe(TipoTratamientoEstructural.CORONA);
    });
  });

  // ─── G. INMUTABILIDAD ESTRICTA DE SNAPSHOTS HISTÓRICOS ──────────────────────

  describe('G. Inmutabilidad Estricta de Snapshots Históricos', () => {
    it('los snapshots anteriores deben permanecer inmutables tras revisiones posteriores (Escenario 8)', async () => {
      const odontograma = await repository.buscarPorHistoriaClinicaId(historiaId);
      expect(odontograma).not.toBeNull();
      if (!odontograma) return;

      // Recuperar la revisión 1 (basal) directamente de MongoDB
      const rev1Doc = await revisionModel.findOne({
        odontogramaId: odontograma.id.valor,
        numeroRevision: 1,
      }).lean().exec();

      expect(rev1Doc).toBeDefined();
      expect(rev1Doc?.snapshotPiezas.length).toBe(52);

      // En la revisión 1, la pieza 16 y la pieza 31 DEBEN conservar su estado original DESCONOCIDO
      // a pesar de que en revisiones posteriores fueron marcadas como PRESENTE con CARIES / CORONA
      const p16EnRev1 = rev1Doc?.snapshotPiezas.find((p) => p.numeroFDI === 16);
      expect(p16EnRev1?.estadoAnatomico).toBe(EstadoAnatomicoPieza.DESCONOCIDO);
      expect(p16EnRev1?.estadoEvaluacion).toBe(EstadoEvaluacionPieza.NO_EVALUADO);

      const p31EnRev1 = rev1Doc?.snapshotPiezas.find((p) => p.numeroFDI === 31);
      expect(p31EnRev1?.estadoAnatomico).toBe(EstadoAnatomicoPieza.DESCONOCIDO);
      expect(p31EnRev1?.tratamientosEstructurales.length).toBe(0);

      // En el estado consolidado actual (versión 6), esas piezas sí tienen sus cambios
      const pieza16Actual = odontograma.obtenerPieza(16);
      expect(pieza16Actual.estadoAnatomico).toBe(EstadoAnatomicoPieza.PRESENTE);
    });
  });

  // ─── H. AISLAMIENTO MULTI-HISTORIA ──────────────────────────────────────────

  describe('H. Aislamiento Transaccional Entre Múltiples Historias Clínicas', () => {
    it('las revisiones de una historia clínica A no deben afectar ni mezclarse con una historia clínica B (Escenario 13)', async () => {
      const historiaB = HistoriaClinicaId.reconstituir('hc_historia_aislada_bbbb_1234');
      const pacienteB = PacienteId.crear('pac_paciente_aislado_bbbb');

      const { odontograma: oB, revisionBasal: rB } = Odontograma.inicializar({
        historiaClinicaId: historiaB,
        pacienteId: pacienteB,
        odontologoId,
        ahora: fechaFija,
      });

      await repository.guardarInicial(oB, rB);

      // Registrar una revisión en historia B
      const revB2 = oB.aplicarRevision({
        tipoRevision: TipoRevisionOdontograma.NUEVA_OBSERVACION,
        aplicaAlEstadoActual: true,
        odontologoId,
        fechaObservacionClinica: fechaFija,
        motivoRevision: 'Observación exclusiva de historia B',
        versionEsperada: 1,
        deltas: [{ numeroFDI: 44, estadoAnatomicoNuevo: EstadoAnatomicoPieza.PRESENTE }],
      });
      await repository.aplicarRevisionTransaccional(oB, revB2, 1);

      // 1. Historia A conserva sus 6 revisiones intactas
      const revsA = await repository.listarRevisiones((await repository.buscarPorHistoriaClinicaId(historiaId))!.id, 20, 0);
      expect(revsA.total).toBe(6);
      for (const r of revsA.revisiones) {
        expect(r.historiaClinicaId.valor).toBe(historiaId.valor);
        expect(r.historiaClinicaId.valor).not.toBe(historiaB.valor);
      }

      // 2. Historia B tiene exactamente 2 revisiones propias
      const revsB = await repository.listarRevisiones(oB.id, 20, 0);
      expect(revsB.total).toBe(2);
      for (const r of revsB.revisiones) {
        expect(r.historiaClinicaId.valor).toBe(historiaB.valor);
        expect(r.historiaClinicaId.valor).not.toBe(historiaId.valor);
      }
    });
  });

  // ─── I. INTEGRIDAD CRUZADA DE COLECCIONES ───────────────────────────────────

  describe('I. Integridad Cruzada de las Colecciones Transaccionales', () => {
    it('debe mantener consistencia matemática y de llaves entre odontogramas y revisiones (Escenario 14)', async () => {
      const oDocA = await odontogramaModel.findOne({ historiaClinicaId: historiaId.valor }).lean().exec();
      expect(oDocA).toBeDefined();

      const totalRevsColeccion = await revisionModel.countDocuments({ odontogramaId: oDocA?._id });
      expect(totalRevsColeccion).toBe(oDocA?.totalRevisiones);
      expect(oDocA?.revisionActualId).toBeDefined();

      // La revisión actual debe existir y ser la de mayor número
      const revActualDoc = await revisionModel.findById(oDocA?.revisionActualId).lean().exec();
      expect(revActualDoc).toBeDefined();
      expect(revActualDoc?.numeroRevision).toBe(oDocA?.totalRevisiones);

      // Verificación de salvaguarda de puerto: asegurar que connection apunta a 27018
      expect(connection.port).toBe(27018);
      expect(connection.db?.databaseName).toMatch(/^test-odontogramas-int-/);
    });
  });
});
