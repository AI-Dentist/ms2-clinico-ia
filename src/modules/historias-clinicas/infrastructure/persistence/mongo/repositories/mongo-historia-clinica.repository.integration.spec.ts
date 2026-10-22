import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest';
import { randomUUID } from 'node:crypto';
import mongoose, { Connection, Model } from 'mongoose';
import { MongoHistoriaClinicaRepository } from './mongo-historia-clinica.repository.js';
import {
  HistoriaClinicaDocument,
  HistoriaClinicaSchema,
} from '../schemas/historia-clinica.schema.js';
import { HistoriaClinica } from '../../../../domain/entities/historia-clinica.entity.js';
import { PacienteId } from '../../../../domain/value-objects/paciente-id.vo.js';
import { OdontologoId } from '../../../../domain/value-objects/odontologo-id.vo.js';
import { HistoriaClinicaId } from '../../../../domain/value-objects/historia-clinica-id.vo.js';
import { EstadoHistoria } from '../../../../domain/value-objects/estado-historia.enum.js';
import { AccionAuditoria } from '../../../../domain/value-objects/accion-auditoria.enum.js';
import { Antecedentes } from '../../../../domain/value-objects/antecedentes.vo.js';
import { CampoClinico } from '../../../../domain/value-objects/campo-clinico.vo.js';
import { Alergia } from '../../../../domain/value-objects/alergia.vo.js';
import { SeveridadAlergia } from '../../../../domain/value-objects/severidad-alergia.enum.js';
import { Medicamento } from '../../../../domain/value-objects/medicamento.vo.js';
import { HistoriaClinicaDuplicadaError } from '../../../../domain/errors/historia-clinica-duplicada.error.js';
import { ConflictoConcurrenteError } from '../../../../domain/errors/conflicto-concurrente.error.js';
import { HistoriaClinicaNoEncontradaError } from '../../../../domain/errors/historia-clinica-no-encontrada.error.js';

describe('MongoHistoriaClinicaRepository (Integration Tests)', () => {
  let connection: Connection;
  let model: Model<HistoriaClinicaDocument>;
  let repository: MongoHistoriaClinicaRepository;
  let testDbName: string;

  beforeAll(async () => {
    // 1. Generar nombre de base de datos temporal aislado único
    testDbName = `test-clinica-int-${randomUUID()}`;

    // SALVAGUARDA ESTRICTA: Impedir rotundamente cualquier operación sobre la base principal
    if (
      testDbName === 'clinica-dentalDB' ||
      testDbName.includes('clinica-dentalDB')
    ) {
      throw new Error(
        'CRÍTICO: Salvaguarda violada. No se permite ejecutar pruebas de integración sobre la base principal clinica-dentalDB.',
      );
    }

    const testMongoUri = `mongodb://127.0.0.1:27017/${testDbName}`;

    // 2. Conectar a la base de datos de prueba
    connection = await mongoose.createConnection(testMongoUri).asPromise();

    // 3. Registrar modelo y compilar índices (incluyendo el índice único en pacienteId)
    model = connection.model(
      HistoriaClinicaDocument.name,
      HistoriaClinicaSchema,
    ) as unknown as Model<HistoriaClinicaDocument>;
    await model.syncIndexes();

    repository = new MongoHistoriaClinicaRepository(model);
  }, 20000);

  afterAll(async () => {
    if (connection) {
      // SALVAGUARDA ESTRICTA de limpieza: verificar nombre antes de drop
      const currentDb = connection.db?.databaseName;
      if (currentDb && currentDb.startsWith('test-clinica-int-')) {
        await connection.dropDatabase();
      }
      await connection.close();
    }
  });

  beforeEach(async () => {
    // Limpieza de colecciones en la base temporal entre cada prueba
    await model.deleteMany({});
  });

  // Helper para construir historia clínica completa
  const crearHistoriaCompleta = (pacienteRawId: string): HistoriaClinica => {
    const pacienteId = PacienteId.crear(pacienteRawId);
    const operadorId = OdontologoId.crear('od_operador_01');
    const responsableId = OdontologoId.crear('od_responsable_02');

    const antecedentes = Antecedentes.crear({
      enfermedadesCronicas: [
        CampoClinico.crear({
          nombre: 'Hipertensión Arterial',
          estado: 'CONFIRMADO',
          detalle: 'Tratado con Enalapril 10mg',
          registradoEn: new Date('2025-05-10T10:00:00.000Z'),
        }),
      ],
      antecedentesMedicos: [
        CampoClinico.crear({
          nombre: 'Cirugía de apéndice',
          estado: 'CONFIRMADO',
          detalle: 'Apendicectomía en 2018 sin complicaciones',
        }),
      ],
      antecedentesFamiliares: [
        CampoClinico.crear({
          nombre: 'Diabetes en familiares de primer grado',
          estado: 'NEGADO',
        }),
      ],
      antecedentesOdontologicos: {
        tratamientoPrevio: CampoClinico.crear({
          estado: 'CONFIRMADO',
          detalle: 'Ortodoncia finalizada hace 3 años',
        }),
        protesisActual: CampoClinico.crear({ estado: 'NEGADO' }),
        sangradoGingival: CampoClinico.crear({
          estado: 'CONFIRMADO',
          detalle: 'Esporádico al cepillado',
        }),
        bruxismo: CampoClinico.crear({ estado: 'NO_EVALUADO' }),
      },
    });

    const alergia = Alergia.crear({
      sustancia: 'Penicilina',
      tipoReaccion: 'Urticaria aguda',
      severidad: SeveridadAlergia.GRAVE,
      notasAdicionales: 'Reportado por el paciente en primera anamnesis',
      registradaEn: new Date('2025-05-10T10:05:00.000Z'),
    });

    const medicamento = Medicamento.crear({
      nombre: 'Enalapril 10mg',
      principioActivo: 'Enalapril maleato',
      dosis: '1 comp cada 24h',
      motivoUso: 'Antihipertensivo',
      prescritoDesde: new Date('2024-01-01T00:00:00.000Z'),
    });

    return HistoriaClinica.crear(
      {
        pacienteId,
        odontologoResponsableId: responsableId,
        antecedentes,
        alergias: [alergia],
        medicamentosActuales: [medicamento],
        observacionesGenerales: 'Paciente con ansiedad dental moderada.',
      },
      operadorId,
    );
  };

  it('debe guardar y recuperar íntegramente una historia clínica completa por ID', async () => {
    const historia = crearHistoriaCompleta('pac_int_001');

    await repository.guardar(historia);

    const recuperada = await repository.buscarPorId(historia.id);

    expect(recuperada).not.toBeNull();
    if (!recuperada) return;

    // Identificadores y versiones
    expect(recuperada.id.valor).toBe(historia.id.valor);
    expect(recuperada.pacienteId.valor).toBe('pac_int_001');
    expect(recuperada.odontologoResponsableId.valor).toBe('od_responsable_02');
    expect(recuperada.estado).toBe(EstadoHistoria.ACTIVA);
    expect(recuperada.version).toBe(1);
    expect(recuperada.observacionesGenerales).toBe('Paciente con ansiedad dental moderada.');

    // Antecedentes estructurados y estados epistémicos
    expect(recuperada.antecedentes.enfermedadesCronicas).toHaveLength(1);
    const enf = recuperada.antecedentes.enfermedadesCronicas[0];
    expect(enf.nombre).toBe('Hipertensión Arterial');
    expect(enf.estado).toBe('CONFIRMADO');
    expect(enf.detalle).toBe('Tratado con Enalapril 10mg');

    const fam = recuperada.antecedentes.antecedentesFamiliares[0];
    expect(fam.estado).toBe('NEGADO');
    expect(fam.detalle).toBeNull();

    const brux = recuperada.antecedentes.antecedentesOdontologicos.bruxismo;
    expect(brux.estado).toBe('NO_EVALUADO');

    // Alergias
    expect(recuperada.alergias).toHaveLength(1);
    expect(recuperada.alergias[0].sustancia).toBe('Penicilina');
    expect(recuperada.alergias[0].severidad).toBe(SeveridadAlergia.GRAVE);

    // Medicamentos
    expect(recuperada.medicamentosActuales).toHaveLength(1);
    expect(recuperada.medicamentosActuales[0].nombre).toBe('Enalapril 10mg');

    // Integridad de auditoría
    expect(recuperada.historialCambios).toHaveLength(1);
    expect(recuperada.historialCambios[0].accion).toBe(AccionAuditoria.CREACION);
    expect(recuperada.historialCambios[0].odontologoId).toBe('od_operador_01');
  });

  it('debe buscar y comprobar existencia por PacienteId', async () => {
    const historia = crearHistoriaCompleta('pac_int_002');
    await repository.guardar(historia);

    const encontrada = await repository.buscarPorPacienteId(historia.pacienteId);
    expect(encontrada).not.toBeNull();
    expect(encontrada?.pacienteId.valor).toBe('pac_int_002');

    const existe = await repository.existePorPacienteId(historia.pacienteId);
    expect(existe).toBe(true);

    const noExiste = await repository.existePorPacienteId(
      PacienteId.crear('pac_totalmente_inexistente'),
    );
    expect(noExiste).toBe(false);

    const buscadaNoExiste = await repository.buscarPorId(
      HistoriaClinicaId.reconstituir('hc_00000000-0000-0000-0000-000000000000'),
    );
    expect(buscadaNoExiste).toBeNull();
  });

  it('debe hacer cumplir la invariante de unicidad por pacienteId lanzando HistoriaClinicaDuplicadaError', async () => {
    const historia1 = crearHistoriaCompleta('pac_int_duplicado');
    await repository.guardar(historia1);

    // Intentar crear un segundo expediente para el mismo paciente
    const historia2 = crearHistoriaCompleta('pac_int_duplicado');

    await expect(repository.guardar(historia2)).rejects.toThrow(
      HistoriaClinicaDuplicadaError,
    );
  });

  it('debe rechazar creaciones concurrentes con el mismo pacienteId garantizando que solo una triunfe', async () => {
    const h1 = crearHistoriaCompleta('pac_concurrente_001');
    const h2 = crearHistoriaCompleta('pac_concurrente_001');

    const resultados = await Promise.allSettled([
      repository.guardar(h1),
      repository.guardar(h2),
    ]);

    const exitosos = resultados.filter((r) => r.status === 'fulfilled');
    const rechazados = resultados.filter((r) => r.status === 'rejected');

    expect(exitosos).toHaveLength(1);
    expect(rechazados).toHaveLength(1);

    const razonRechazo = (rechazados[0] as PromiseRejectedResult).reason;
    expect(razonRechazo).toBeInstanceOf(HistoriaClinicaDuplicadaError);
  });

  it('debe ejecutar actualización atómica con versionEsperada sin incluir _id en $set', async () => {
    const historia = crearHistoriaCompleta('pac_int_update');
    await repository.guardar(historia);
    expect(historia.version).toBe(1);

    // Modificar antecedentes en dominio
    const nuevosAntecedentes = Antecedentes.crear({
      enfermedadesCronicas: [],
      antecedentesMedicos: [],
      antecedentesFamiliares: [],
      antecedentesOdontologicos: {
        tratamientoPrevio: CampoClinico.crear({ estado: 'NO_EVALUADO' }),
        protesisActual: CampoClinico.crear({ estado: 'NO_EVALUADO' }),
        sangradoGingival: CampoClinico.crear({
          estado: 'CONFIRMADO',
          detalle: 'Gingivitis leve tratada',
        }),
        bruxismo: CampoClinico.crear({ estado: 'NO_EVALUADO' }),
      },
    });

    historia.actualizarAntecedentes(
      nuevosAntecedentes,
      OdontologoId.crear('od_editor_99'),
      ['antecedentes.antecedentesOdontologicos'],
      'Tratamiento de profilaxis realizado',
    );
    expect(historia.version).toBe(2);

    // Actualizar con versionEsperada = 1
    const actualizada = await repository.actualizar(historia, 1);

    expect(actualizada.version).toBe(2);
    expect(actualizada.historialCambios).toHaveLength(2);
    expect(actualizada.historialCambios[1].accion).toBe(
      AccionAuditoria.ACTUALIZACION_ANTECEDENTES,
    );
    expect(actualizada.historialCambios[1].odontologoId).toBe('od_editor_99');

    // Verificar en BD
    const enDb = await repository.buscarPorId(historia.id);
    expect(enDb?.version).toBe(2);
  });

  it('debe lanzar ConflictoConcurrenteError si versionEsperada no coincide con la versión en BD', async () => {
    const historia = crearHistoriaCompleta('pac_int_concurrencia');
    await repository.guardar(historia);

    // Primer proceso modifica exitosamente (pasa de 1 a 2)
    historia.actualizarObservaciones(
      'Observación del proceso A',
      OdontologoId.crear('od_proc_a'),
    );
    await repository.actualizar(historia, 1);

    // Segundo proceso intenta actualizar basándose en versión obsoleta 1
    const historiaObsoleta = crearHistoriaCompleta('pac_int_concurrencia');
    // Forzamos el mismo ID pero intentamos versionEsperada = 1 cuando en BD ya es 2
    Object.defineProperty(historiaObsoleta, '_id', { value: historia.id });
    historiaObsoleta.actualizarObservaciones(
      'Observación en conflicto del proceso B',
      OdontologoId.crear('od_proc_b'),
    );

    let errorCapturado: unknown;
    try {
      await repository.actualizar(historiaObsoleta, 1);
    } catch (err) {
      errorCapturado = err;
    }

    expect(errorCapturado).toBeInstanceOf(ConflictoConcurrenteError);
    const conflicto = errorCapturado as ConflictoConcurrenteError;
    expect(conflicto.versionActual).toBe(2);
  });

  it('debe persistir cambios de estado de la historia clínica en MongoDB', async () => {
    const historia = crearHistoriaCompleta('pac_int_estados');
    await repository.guardar(historia);

    // Cambiar a CERRADA
    historia.cambiarEstado(
      EstadoHistoria.CERRADA,
      OdontologoId.crear('od_cierre_01'),
      'Fin de tratamiento integral',
    );
    await repository.actualizar(historia, 1);

    const cerrada = await repository.buscarPorId(historia.id);
    expect(cerrada?.estado).toBe(EstadoHistoria.CERRADA);
    expect(cerrada?.version).toBe(2);

    // Reapertura a ACTIVA
    cerrada?.cambiarEstado(
      EstadoHistoria.ACTIVA,
      OdontologoId.crear('od_reapertura_02'),
      'Reapertura por dolor agudo',
    );
    if (cerrada) {
      await repository.actualizar(cerrada, 2);
    }

    const reabierta = await repository.buscarPorId(historia.id);
    expect(reabierta?.estado).toBe(EstadoHistoria.ACTIVA);
    expect(reabierta?.version).toBe(3);
    expect(reabierta?.historialCambios).toHaveLength(3);
  });

  it('debe lanzar HistoriaClinicaNoEncontradaError si se intenta actualizar un ID no existente', async () => {
    const historiaInexistente = crearHistoriaCompleta('pac_no_existe_update');

    await expect(
      repository.actualizar(historiaInexistente, 1),
    ).rejects.toThrow(HistoriaClinicaNoEncontradaError);
  });
});
