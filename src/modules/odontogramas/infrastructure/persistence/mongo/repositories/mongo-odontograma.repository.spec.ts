import { describe, it, expect, vi, beforeEach } from 'vitest';
import { MongoOdontogramaRepository } from './mongo-odontograma.repository.js';
import { Odontograma } from '../../../../domain/entities/odontograma.entity.js';
import { HistoriaClinicaId } from '../../../../../historias-clinicas/domain/value-objects/historia-clinica-id.vo.js';
import { PacienteId } from '../../../../../historias-clinicas/domain/value-objects/paciente-id.vo.js';
import { OdontologoId } from '../../../../../historias-clinicas/domain/value-objects/odontologo-id.vo.js';
import { ConsultaId } from '../../../../../consultas-odontologicas/domain/value-objects/consulta-id.vo.js';
import { TipoRevisionOdontograma } from '../../../../domain/value-objects/tipo-revision-odontograma.enum.js';
import { TransaccionNoSoportadaError } from '../errors/transaccion-no-soportada.error.js';
import { ConflictoConcurrenteOdontogramaError } from '../../../../domain/errors/conflicto-concurrente-odontograma.error.js';
import { OdontogramaDuplicadoError } from '../../../../domain/errors/odontograma-duplicado.error.js';
import { OdontogramaMongoMapper } from '../mappers/odontograma-mongo.mapper.js';

describe('MongoOdontogramaRepository (Unit Tests with Mocks)', () => {
  let repository: MongoOdontogramaRepository;
  let mockOdontogramaModel: any;
  let mockRevisionModel: any;
  let mockConnection: any;
  let mockSession: any;

  const historiaId = HistoriaClinicaId.reconstituir('hc_12345678-1234-1234-1234-123456789abc');
  const pacienteId = PacienteId.crear('pac_87654321-4321-4321-4321-abcdef123456');
  const odontologoId = OdontologoId.crear('od_henry_principal');

  let odontogramaTest: Odontograma;
  let revisionBasalTest: any;

  beforeEach(() => {
    const init = Odontograma.inicializar({
      historiaClinicaId: historiaId,
      pacienteId,
      odontologoId,
    });
    odontogramaTest = init.odontograma;
    revisionBasalTest = init.revisionBasal;

    mockSession = {
      withTransaction: vi.fn(async (callback: () => Promise<void>) => {
        await callback();
      }),
      endSession: vi.fn().mockResolvedValue(undefined),
    };

    mockConnection = {
      startSession: vi.fn().mockResolvedValue(mockSession),
      getClient: vi.fn().mockReturnValue({
        topology: {
          description: {
            type: 'ReplicaSetWithPrimary',
            servers: new Map([['127.0.0.1:27017', { setName: 'rs0' }]]),
          },
        },
      }),
    };

    mockOdontogramaModel = {
      create: vi.fn().mockResolvedValue([OdontogramaMongoMapper.odontogramaToPersistence(odontogramaTest)]),
      updateOne: vi.fn().mockResolvedValue({ matchedCount: 1, modifiedCount: 1 }),
      findById: vi.fn().mockReturnValue({
        exec: vi.fn().mockResolvedValue(OdontogramaMongoMapper.odontogramaToPersistence(odontogramaTest)),
      }),
      findOne: vi.fn().mockReturnValue({
        exec: vi.fn().mockResolvedValue(OdontogramaMongoMapper.odontogramaToPersistence(odontogramaTest)),
      }),
    };

    mockRevisionModel = {
      create: vi.fn().mockResolvedValue([OdontogramaMongoMapper.revisionToPersistence(revisionBasalTest)]),
      findById: vi.fn().mockReturnValue({
        exec: vi.fn().mockResolvedValue(OdontogramaMongoMapper.revisionToPersistence(revisionBasalTest)),
      }),
      find: vi.fn().mockReturnValue({
        sort: vi.fn().mockReturnValue({
          skip: vi.fn().mockReturnValue({
            limit: vi.fn().mockReturnValue({
              exec: vi.fn().mockResolvedValue([OdontogramaMongoMapper.revisionToPersistence(revisionBasalTest)]),
            }),
          }),
          exec: vi.fn().mockResolvedValue([OdontogramaMongoMapper.revisionToPersistence(revisionBasalTest)]),
        }),
      }),
      countDocuments: vi.fn().mockReturnValue({
        exec: vi.fn().mockResolvedValue(1),
      }),
    };

    repository = new MongoOdontogramaRepository(
      mockOdontogramaModel,
      mockRevisionModel,
      mockConnection
    );
  });

  describe('Guardas de Capacidad Transaccional', () => {
    it('debe rechazar escrituras con TransaccionNoSoportadaError si el servidor opera en Standalone (Single sin setName)', async () => {
      mockConnection.getClient.mockReturnValue({
        topology: {
          description: {
            type: 'Single',
            servers: new Map([['127.0.0.1:27017', { setName: undefined }]]),
          },
        },
      });

      await expect(
        repository.guardarInicial(odontogramaTest, revisionBasalTest)
      ).rejects.toThrow(TransaccionNoSoportadaError);

      // Cero operaciones de escritura ejecutadas
      expect(mockOdontogramaModel.create).not.toHaveBeenCalled();
      expect(mockRevisionModel.create).not.toHaveBeenCalled();
      expect(mockConnection.startSession).not.toHaveBeenCalled();
    });

    it('debe rechazar aplicarRevisionTransaccional en Standalone sin mutar datos', async () => {
      mockConnection.getClient.mockReturnValue({
        topology: {
          description: {
            type: 'Single',
            servers: new Map([['127.0.0.1:27017', {}]]),
          },
        },
      });

      const nuevaRevision = odontogramaTest.aplicarRevision({
        tipoRevision: TipoRevisionOdontograma.NUEVA_OBSERVACION,
        aplicaAlEstadoActual: true,
        odontologoId,
        fechaObservacionClinica: new Date(),
        motivoRevision: 'Revisión en servidor standalone',
        versionEsperada: 1,
        deltas: [],
      });

      await expect(
        repository.aplicarRevisionTransaccional(odontogramaTest, nuevaRevision, 1)
      ).rejects.toThrow(TransaccionNoSoportadaError);

      expect(mockOdontogramaModel.updateOne).not.toHaveBeenCalled();
      expect(mockRevisionModel.create).not.toHaveBeenCalled();
    });

    it('debe capturar error nativo de MongoDB (code 20) si falla la transacción en tiempo de ejecución', async () => {
      mockSession.withTransaction.mockRejectedValueOnce({
        code: 20,
        message: 'Transaction numbers are only allowed on a replica set member or mongos',
      });

      await expect(
        repository.guardarInicial(odontogramaTest, revisionBasalTest)
      ).rejects.toThrow(TransaccionNoSoportadaError);

      expect(mockSession.endSession).toHaveBeenCalledTimes(1);
    });
  });

  describe('guardarInicial (Transaccional)', () => {
    it('debe persistir atómicamente odontograma inicial y revisión basal en una sola transacción', async () => {
      await repository.guardarInicial(odontogramaTest, revisionBasalTest);

      expect(mockConnection.startSession).toHaveBeenCalledTimes(1);
      expect(mockSession.withTransaction).toHaveBeenCalledTimes(1);
      expect(mockOdontogramaModel.create).toHaveBeenCalledWith(
        [expect.objectContaining({ _id: odontogramaTest.id.valor })],
        { session: mockSession }
      );
      expect(mockRevisionModel.create).toHaveBeenCalledWith(
        [expect.objectContaining({ _id: revisionBasalTest.id.valor, numeroRevision: 1 })],
        { session: mockSession }
      );
      expect(mockSession.endSession).toHaveBeenCalledTimes(1);
    });

    it('debe transformar error de clave duplicada E11000 en OdontogramaDuplicadoError', async () => {
      mockOdontogramaModel.create.mockRejectedValueOnce({
        code: 11000,
        keyPattern: { historiaClinicaId: 1 },
      });

      await expect(
        repository.guardarInicial(odontogramaTest, revisionBasalTest)
      ).rejects.toThrow(OdontogramaDuplicadoError);

      expect(mockSession.endSession).toHaveBeenCalledTimes(1);
    });

    it('debe finalizar la sesión en finally si la transacción aborta por error inesperado', async () => {
      mockRevisionModel.create.mockRejectedValueOnce(new Error('Fallo crítico de I/O en disco'));

      await expect(
        repository.guardarInicial(odontogramaTest, revisionBasalTest)
      ).rejects.toThrow('Fallo crítico de I/O en disco');

      expect(mockSession.endSession).toHaveBeenCalledTimes(1);
    });
  });

  describe('aplicarRevisionTransaccional (Concurrencia Optimista y Rollback)', () => {
    it('debe insertar la revisión y actualizar el odontograma con filtro atómico de versión', async () => {
      const nuevaRevision = odontogramaTest.aplicarRevision({
        tipoRevision: TipoRevisionOdontograma.NUEVA_OBSERVACION,
        aplicaAlEstadoActual: true,
        odontologoId,
        fechaObservacionClinica: new Date(),
        motivoRevision: 'Nueva observación clínica válida',
        versionEsperada: 1,
        deltas: [],
      });

      await repository.aplicarRevisionTransaccional(odontogramaTest, nuevaRevision, 1);

      expect(mockConnection.startSession).toHaveBeenCalledTimes(1);
      expect(mockSession.withTransaction).toHaveBeenCalledTimes(1);

      expect(mockRevisionModel.create).toHaveBeenCalledWith(
        [expect.objectContaining({ _id: nuevaRevision.id.valor, numeroRevision: 2 })],
        { session: mockSession }
      );

      expect(mockOdontogramaModel.updateOne).toHaveBeenCalledWith(
        { _id: odontogramaTest.id.valor, version: 1 },
        expect.objectContaining({
          $set: expect.objectContaining({ version: 2, totalRevisiones: 2 }),
        }),
        { session: mockSession }
      );

      expect(mockSession.endSession).toHaveBeenCalledTimes(1);
    });

    it('debe abortar la transacción y lanzar ConflictoConcurrenteOdontogramaError si matchedCount es 0', async () => {
      mockOdontogramaModel.updateOne.mockResolvedValueOnce({ matchedCount: 0, modifiedCount: 0 });

      const nuevaRevision = odontogramaTest.aplicarRevision({
        tipoRevision: TipoRevisionOdontograma.NUEVA_OBSERVACION,
        aplicaAlEstadoActual: true,
        odontologoId,
        fechaObservacionClinica: new Date(),
        motivoRevision: 'Revisión con versión en conflicto',
        versionEsperada: 1,
        deltas: [],
      });

      await expect(
        repository.aplicarRevisionTransaccional(odontogramaTest, nuevaRevision, 1)
      ).rejects.toThrow(ConflictoConcurrenteOdontogramaError);

      expect(mockSession.endSession).toHaveBeenCalledTimes(1);
    });
  });

  describe('Consultas y Lecturas de Dominio', () => {
    it('debe buscar odontograma por id retornando agregado reconstituido', async () => {
      const resultado = await repository.buscarPorId(odontogramaTest.id);

      expect(resultado).toBeDefined();
      expect(resultado?.id.valor).toBe(odontogramaTest.id.valor);
      expect(resultado?.piezas.size).toBe(52);
    });

    it('debe buscar odontograma por historiaClinicaId retornando null si no existe', async () => {
      mockOdontogramaModel.findOne.mockReturnValueOnce({
        exec: vi.fn().mockResolvedValue(null),
      });

      const resultado = await repository.buscarPorHistoriaClinicaId(historiaId);
      expect(resultado).toBeNull();
    });

    it('debe buscar revisión histórica por id', async () => {
      const resultado = await repository.buscarRevisionPorId(revisionBasalTest.id);

      expect(resultado).toBeDefined();
      expect(resultado?.id.valor).toBe(revisionBasalTest.id.valor);
      expect(resultado?.snapshotPiezas.length).toBe(52);
    });

    it('debe listar historial de revisiones paginado con orden descendente', async () => {
      const resultado = await repository.listarRevisiones(odontogramaTest.id, 10, 0);

      expect(resultado.total).toBe(1);
      expect(resultado.revisiones.length).toBe(1);
      expect(mockRevisionModel.find).toHaveBeenCalledWith({ odontogramaId: odontogramaTest.id.valor });
    });

    it('debe listar múltiples revisiones por consultaId ordenadas cronológicamente', async () => {
      const consultaId = ConsultaId.generar();
      const resultado = await repository.listarRevisionesPorConsultaId(consultaId);

      expect(resultado).toBeDefined();
      expect(resultado.length).toBe(1);
      expect(mockRevisionModel.find).toHaveBeenCalledWith({ consultaId: consultaId.valor });
    });
  });
});
