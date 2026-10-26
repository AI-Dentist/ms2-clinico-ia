import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest';
import { randomUUID } from 'node:crypto';
import net from 'node:net';
import mongoose, { Connection } from 'mongoose';

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
import { MongoOdontogramaRepository } from './repositories/mongo-odontograma.repository.js';
import {
  OdontogramaDocument,
  OdontogramaSchema,
} from './schemas/odontograma.schema.js';
import {
  RevisionOdontogramaDocument,
  RevisionOdontogramaSchema,
} from './schemas/revision-odontograma.schema.js';
import { LocalHistoriaClinicaContextAdapter } from '../../adapters/local-historia-clinica-context.adapter.js';
import { LocalConsultaOdontologicaContextAdapter } from '../../adapters/local-consulta-odontologica-context.adapter.js';
import { MockOdontologoContextAdapter } from '../../adapters/mock-odontologo-context.adapter.js';
import { InicializarOdontogramaUseCase } from '../../../application/use-cases/inicializar-odontograma.use-case.js';
import { RegistrarRevisionOdontogramaUseCase } from '../../../application/use-cases/registrar-revision-odontograma.use-case.js';
import { ObtenerOdontogramaActualUseCase } from '../../../application/use-cases/obtener-odontograma-actual.use-case.js';
import { ListarHistorialRevisionesUseCase } from '../../../application/use-cases/listar-historial-revisiones.use-case.js';
import type { IHistoriaClinicaRepository } from '../../../../historias-clinicas/domain/ports/historia-clinica.repository.port.js';
import type { IConsultaOdontologicaRepositoryPort } from '../../../../consultas-odontologicas/domain/ports/consulta-odontologica.repository.port.js';
import { HistoriaClinicaId } from '../../../../historias-clinicas/domain/value-objects/historia-clinica-id.vo.js';
import { PacienteId } from '../../../../historias-clinicas/domain/value-objects/paciente-id.vo.js';
import { ConsultaId } from '../../../../consultas-odontologicas/domain/value-objects/consulta-id.vo.js';
import { TipoRevisionOdontograma } from '../../../domain/value-objects/tipo-revision-odontograma.enum.js';
import { EstadoAnatomicoPieza } from '../../../domain/value-objects/estado-anatomico-pieza.enum.js';
import { TipoSuperficie } from '../../../domain/value-objects/tipo-superficie.enum.js';
import { CondicionSuperficie } from '../../../domain/value-objects/condicion-superficie.enum.js';

describe('Odontogramas Application <-> Persistence Integration Tests', () => {
  let connection: Connection;
  let odontogramaModel: any;
  let revisionModel: any;
  let repository: MongoOdontogramaRepository;
  let testDbName: string;

  // Casos de uso
  let inicializarUseCase: InicializarOdontogramaUseCase;
  let registrarRevisionUseCase: RegistrarRevisionOdontogramaUseCase;
  let obtenerActualUseCase: ObtenerOdontogramaActualUseCase;
  let listarHistorialUseCase: ListarHistorialRevisionesUseCase;
  let odontogramaIdCreado: string;

  const historiaIdStr = `hc_${randomUUID()}`;
  const pacienteIdStr = `pac_${randomUUID()}`;
  const consultaIdStr = `cons_${randomUUID()}`;
  const tokenValido = 'token_dev_henry'; // Mapea a 'od_henry_principal'

  beforeAll(async () => {
    const isAvailable = await isPortReachable(27018);
    if (!isAvailable) {
      console.warn('Servidor replica set de pruebas en puerto 27018 no activo. Omitiendo suite de integración application.');
      return;
    }

    testDbName = `test-odontogramas-app-int-${randomUUID()}`;

    const testMongoUri = `mongodb://127.0.0.1:27018/${testDbName}?replicaSet=rs_odontograma_test`;
    connection = await mongoose.createConnection(testMongoUri).asPromise();

    if (connection.port !== 27018) {
      await connection.close();
      throw new Error(`CRÍTICO: Conexión debe ser en puerto 27018 (recibido: ${connection.port})`);
    }

    odontogramaModel = connection.model(OdontogramaDocument.name, OdontogramaSchema);
    revisionModel = connection.model(RevisionOdontogramaDocument.name, RevisionOdontogramaSchema);

    await Promise.all([
      odontogramaModel.createIndexes(),
      revisionModel.createIndexes(),
    ]);

    repository = new MongoOdontogramaRepository(odontogramaModel, revisionModel, connection);

    // Mocks de repositorio para los adaptadores de contexto
    const mockHistoriaRepo: IHistoriaClinicaRepository = {
      buscarPorId: async (id) => {
        if (id.valor === historiaIdStr) {
          return {
            id: HistoriaClinicaId.reconstituir(historiaIdStr),
            pacienteId: PacienteId.crear(pacienteIdStr),
            estado: 'ACTIVA',
          } as any;
        }
        return null;
      },
      guardar: async () => {},
      buscarPorPacienteId: async () => null,
      existePorPacienteId: async () => true,
      actualizar: async (h) => h,
    };

    const mockConsultaRepo: IConsultaOdontologicaRepositoryPort = {
      buscarPorId: async (id) => {
        if (id.valor === consultaIdStr) {
          return {
            id: ConsultaId.reconstituir(consultaIdStr),
            historiaClinicaId: HistoriaClinicaId.reconstituir(historiaIdStr),
            pacienteId: PacienteId.crear(pacienteIdStr),
            estado: 'EN_CURSO',
          } as any;
        }
        return null;
      },
      guardar: async () => {},
      actualizar: async () => {},
      buscarPorCitaId: async () => null,
      listarPorHistoriaClinica: async () => ({ consultas: [], total: 0 }),
      listarPorPacienteId: async () => ({ consultas: [], total: 0 }),
    };

    const historiaContext = new LocalHistoriaClinicaContextAdapter(mockHistoriaRepo);
    const consultaContext = new LocalConsultaOdontologicaContextAdapter(mockConsultaRepo);
    const odontologoContext = new MockOdontologoContextAdapter();

    inicializarUseCase = new InicializarOdontogramaUseCase(
      repository,
      historiaContext,
      odontologoContext
    );

    registrarRevisionUseCase = new RegistrarRevisionOdontogramaUseCase(
      repository,
      historiaContext,
      consultaContext,
      odontologoContext
    );

    obtenerActualUseCase = new ObtenerOdontogramaActualUseCase(repository, historiaContext);
    listarHistorialUseCase = new ListarHistorialRevisionesUseCase(repository);
  }, 30000);

  afterAll(async () => {
    if (connection) {
      if (connection.port === 27018 && connection.db?.databaseName.startsWith('test-odontogramas-app-int-')) {
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

  it('1. Caso de uso InicializarOdontograma debe crear y persistir el expediente odontográfico basal', async () => {
    const resultado = await inicializarUseCase.ejecutar({
      historiaClinicaId: historiaIdStr,
      tokenOdontologo: tokenValido,
    });

    expect(resultado.id).toBeDefined();
    expect(resultado.historiaClinicaId).toBe(historiaIdStr);
    expect(resultado.pacienteId).toBe(pacienteIdStr);
    expect(resultado.version).toBe(1);
    expect(resultado.totalRevisiones).toBe(1);
    expect(resultado.piezas.length).toBe(52);

    // Guardamos el odontogramaId generado
    odontogramaIdCreado = resultado.id;

    // Verificar lectura inmediata a través de caso de uso
    const actual = await obtenerActualUseCase.ejecutar({
      historiaClinicaId: historiaIdStr,
    });

    expect(actual.id).toBe(resultado.id);
    expect(actual.version).toBe(1);
    expect(actual.piezas.length).toBe(52);
  });

  it('2. Caso de uso RegistrarRevisionOdontograma debe persistir revisión y actualizar estado actual', async () => {
    const revisionResultado = await registrarRevisionUseCase.ejecutar({
      odontogramaId: odontogramaIdCreado,
      consultaId: consultaIdStr,
      tipoRevision: TipoRevisionOdontograma.NUEVA_OBSERVACION,
      motivoRevision: 'Caries detectada en exploración clínica inicial',
      fechaObservacionClinica: new Date('2026-10-25T11:00:00.000Z'),
      aplicaAlEstadoActual: true,
      versionEsperada: 1,
      tokenOdontologo: tokenValido,
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

    expect(revisionResultado.numeroRevision).toBe(2);

    // Verificar proyección clínica actualizada
    const odontogramaActualizado = await obtenerActualUseCase.ejecutar({
      historiaClinicaId: historiaIdStr,
    });

    expect(odontogramaActualizado.version).toBe(2);
    const pieza16 = odontogramaActualizado.piezas.find((p) => p.numeroFDI === 16);
    expect(pieza16?.estadoAnatomico).toBe(EstadoAnatomicoPieza.PRESENTE);
    expect(pieza16?.superficies[TipoSuperficie.OCLUSAL_INCISAL]?.condicion).toBe(
      CondicionSuperficie.CARIES
    );
  });

  it('3. Caso de uso ListarHistorialRevisiones debe retornar historial paginado con orden descendente', async () => {
    const historial = await listarHistorialUseCase.ejecutar({
      odontogramaId: odontogramaIdCreado,
      limite: 10,
      offset: 0,
    });

    expect(historial.total).toBe(2);
    expect(historial.revisiones.length).toBe(2);
    expect(historial.revisiones[0].numeroRevision).toBe(2);
    expect(historial.revisiones[1].numeroRevision).toBe(1);
    expect(historial.revisiones[0].snapshotPiezas.length).toBe(52);
    expect(historial.revisiones[1].snapshotPiezas.length).toBe(52);
  });
});
