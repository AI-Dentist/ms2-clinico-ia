import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest';
import { randomUUID } from 'node:crypto';
import mongoose, { Connection, Model } from 'mongoose';
import { MongoConsultaOdontologicaRepository } from './mongo-consulta-odontologica.repository.js';
import {
  ConsultaOdontologicaDocument,
  ConsultaOdontologicaSchema,
} from '../schemas/consulta-odontologica.schema.js';
import { ConsultaOdontologica } from '../../../../domain/entities/consulta-odontologica.entity.js';
import { HistoriaClinicaId } from '../../../../domain/value-objects/historia-clinica-id.vo.js';
import { PacienteId } from '../../../../domain/value-objects/paciente-id.vo.js';
import { OdontologoId } from '../../../../domain/value-objects/odontologo-id.vo.js';
import { CitaId } from '../../../../domain/value-objects/cita-id.vo.js';
import { MotivoConsulta } from '../../../../domain/value-objects/motivo-consulta.vo.js';
import { AnamnesisActual } from '../../../../domain/value-objects/anamnesis-actual.vo.js';
import { ExploracionFisica } from '../../../../domain/value-objects/exploracion-fisica.vo.js';
import { DiagnosticoItem } from '../../../../domain/value-objects/diagnostico-item.vo.js';
import { TipoDiagnostico } from '../../../../domain/value-objects/tipo-diagnostico.enum.js';
import { ProcedimientoRealizado } from '../../../../domain/value-objects/procedimiento-realizado.vo.js';
import { PiezaDentalFDI } from '../../../../domain/value-objects/pieza-dental-fdi.vo.js';
import { EvolucionSOAP } from '../../../../domain/value-objects/evolucion-soap.vo.js';
import { SnapshotRiesgoClinico } from '../../../../domain/value-objects/snapshot-riesgo-clinico.vo.js';
import { EstadoConsulta } from '../../../../domain/value-objects/estado-consulta.enum.js';
import { ConflictoConcurrenteConsultaError } from '../../../../domain/errors/conflicto-concurrente-consulta.error.js';
import { ConsultaNoEncontradaError } from '../../../../domain/errors/consulta-no-encontrada.error.js';
import { CitaInvalidaParaConsultaError } from '../../../../domain/errors/cita-invalida-para-consulta.error.js';

describe('MongoConsultaOdontologicaRepository (Integration Tests)', () => {
  let connection: Connection;
  let model: Model<ConsultaOdontologicaDocument>;
  let repository: MongoConsultaOdontologicaRepository;
  let testDbName: string;

  const historiaIdBase = HistoriaClinicaId.crear('hc_12345678-aaaa-bbbb');
  const pacienteIdBase = PacienteId.crear('pac_dennis_001');
  const odontologoIdBase = OdontologoId.crear('od_henry_principal');
  const fechaFija = new Date('2026-10-22T10:00:00.000Z');

  beforeAll(async () => {
    // 1. Base de datos temporal única y aislada
    testDbName = `test-consultas-int-${randomUUID()}`;

    // Salvaguarda estricta: nunca tocar la base de datos principal
    if (testDbName === 'clinica-dentalDB' || testDbName.includes('clinica-dentalDB')) {
      throw new Error('CRÍTICO: Salvaguarda violada. No se permite ejecutar pruebas sobre clinica-dentalDB.');
    }

    const testMongoUri = `mongodb://127.0.0.1:27017/${testDbName}`;
    connection = await mongoose.createConnection(testMongoUri).asPromise();

    // SALVAGUARDA DE AISLAMIENTO EN TIEMPO DE EJECUCIÓN
    const activeDbName = connection.db?.databaseName;
    if (
      !activeDbName ||
      !activeDbName.startsWith('test-consultas-int-') ||
      activeDbName === 'clinica-dentalDB' ||
      activeDbName === 'admin' ||
      activeDbName === 'local'
    ) {
      await connection.close();
      throw new Error(
        `CRÍTICO: Abortando suite de integración MongoConsultaOdontologicaRepository. Base de datos no autorizada: '${activeDbName}'. Solo se permiten bases temporales 'test-consultas-int-*'.`,
      );
    }

    model = connection.model(
      ConsultaOdontologicaDocument.name,
      ConsultaOdontologicaSchema
    ) as unknown as Model<ConsultaOdontologicaDocument>;

    // Sincronizar índices, incluyendo el índice único parcial de citaId
    await model.syncIndexes();
    repository = new MongoConsultaOdontologicaRepository(model);
  }, 25000);

  afterAll(async () => {
    if (connection) {
      const currentDb = connection.db?.databaseName;
      if (currentDb && currentDb === testDbName && currentDb.startsWith('test-consultas-int-')) {
        await connection.dropDatabase();
      }
      await connection.close();
    }
  });

  beforeEach(async () => {
    const currentDb = connection.db?.databaseName;
    if (!currentDb || !currentDb.startsWith('test-consultas-int-') || currentDb === 'clinica-dentalDB') {
      throw new Error(`CRÍTICO: Operación deleteMany bloqueada en base no autorizada: '${currentDb}'`);
    }
    await model.deleteMany({});
  });

  const crearConsultaValida = (citaRawId?: string | null): ConsultaOdontologica => {
    const consulta = ConsultaOdontologica.abrir(
      {
        historiaClinicaId: historiaIdBase,
        pacienteId: pacienteIdBase,
        odontologoId: odontologoIdBase,
        citaId: citaRawId ? CitaId.crear(citaRawId) : null,
        versionHistoriaReferenciada: 2,
        snapshotRiesgoClinico: SnapshotRiesgoClinico.capturar({
          alergiasCriticas: [{ sustancia: 'Penicilina', severidad: 'GRAVE' }],
          condicionesMedicas: ['Hipertensión arterial'],
          medicacionHabitual: ['Enalapril 10mg'],
          capturadoEn: fechaFija,
        }),
        fechaAtencion: fechaFija,
        motivoConsulta: MotivoConsulta.crear('Dolor pulsátil en pieza 36'),
        anamnesisActual: AnamnesisActual.crear({
          descripcion: 'Dolor continuo espontáneo',
          tiempoEvolucion: '48 horas',
          escalaDolorEVA: 8,
        }),
        exploracionFisica: ExploracionFisica.crear({
          inspeccionIntraoral: 'Caries penetrante en 36 con percusión axial positiva',
        }),
        diagnosticos: [
          DiagnosticoItem.crear({
            codigoCIE10: 'K04.0',
            descripcion: 'Pulpitis irreversible sintomática',
            tipo: TipoDiagnostico.DEFINITIVO,
          }),
        ],
        procedimientosRealizados: [
          ProcedimientoRealizado.crear({
            codigo: 'END-01',
            descripcion: 'Pulpectomía cameral de urgencia',
            piezaDental: PiezaDentalFDI.crear(36),
          }),
        ],
        evolucionSOAP: EvolucionSOAP.crear({
          subjetivo: 'Paciente con dolor punzante',
          analisis: 'Pulpitis aguda',
        }),
        recomendaciones: 'AINEs por 3 días',
      },
      fechaFija
    );

    return consulta;
  };

  it('1. debe guardar y recuperar una consulta odontológica completa por su ID canónico', async () => {
    const consulta = crearConsultaValida();
    await repository.guardar(consulta);

    const recuperada = await repository.buscarPorId(consulta.id);
    expect(recuperada).not.toBeNull();
    expect(recuperada?.id.valor).toBe(consulta.id.valor);
    expect(recuperada?.estado).toBe(EstadoConsulta.EN_CURSO);
    expect(recuperada?.version).toBe(1);
    expect(recuperada?.motivoConsulta.valor).toBe('Dolor pulsátil en pieza 36');
  });

  it('2. debe reconstituir fielmente los Value Objects clínicos complejos', async () => {
    const consulta = crearConsultaValida();
    await repository.guardar(consulta);

    const recuperada = (await repository.buscarPorId(consulta.id))!;
    expect(recuperada.anamnesisActual.escalaDolorEVA).toBe(8);
    expect(recuperada.exploracionFisica.inspeccionIntraoral).toContain('Caries penetrante en 36');
    expect(recuperada.diagnosticos.length).toBe(1);
    expect(recuperada.diagnosticos[0].codigoCIE10).toBe('K04.0');
    expect(recuperada.procedimientosRealizados.length).toBe(1);
    expect(recuperada.procedimientosRealizados[0].piezaDental?.valor).toBe(36);
    expect(recuperada.procedimientosRealizados[0].piezaDental?.esPermanente).toBe(true);
    expect(recuperada.evolucionSOAP.subjetivo).toBe('Paciente con dolor punzante');
  });

  it('3. debe preservar el SnapshotRiesgoClinico inmutable tras persistir y reconstituir', async () => {
    const consulta = crearConsultaValida();
    await repository.guardar(consulta);

    const recuperada = (await repository.buscarPorId(consulta.id))!;
    const snapshot = recuperada.snapshotRiesgoClinico;

    expect(snapshot.alergiasCriticas.length).toBe(1);
    expect(snapshot.alergiasCriticas[0].sustancia).toBe('Penicilina');
    expect(snapshot.alergiasCriticas[0].severidad).toBe('GRAVE');
    expect(snapshot.condicionesMedicas).toContain('Hipertensión arterial');
    expect(snapshot.medicacionHabitual).toContain('Enalapril 10mg');
    expect(snapshot.capturadoEn.toISOString()).toBe(fechaFija.toISOString());
    expect(Object.isFrozen(snapshot)).toBe(true);
  });

  it('4. debe preservar las fechas y campos de auditoría (creadoPor, actualizadoPor)', async () => {
    const consulta = crearConsultaValida();
    await repository.guardar(consulta);

    const recuperada = (await repository.buscarPorId(consulta.id))!;
    expect(recuperada.creadoPor.valor).toBe('od_henry_principal');
    expect(recuperada.actualizadoPor.valor).toBe('od_henry_principal');
    expect(recuperada.creadoEn.toISOString()).toBe(fechaFija.toISOString());
    expect(recuperada.actualizadoEn.toISOString()).toBe(fechaFija.toISOString());
    expect(recuperada.cerradaEn).toBeNull();
  });

  it('5. debe permitir múltiples consultas espontáneas con citaId nulo sin violar la unicidad', async () => {
    const c1 = crearConsultaValida(null);
    const c2 = crearConsultaValida(null);
    const c3 = crearConsultaValida(null);

    await repository.guardar(c1);
    await repository.guardar(c2);
    await repository.guardar(c3);

    const total = await model.countDocuments({ citaId: null });
    expect(total).toBe(3);
  });

  it('6. debe recuperar una consulta por su citaId cuando existe', async () => {
    const consulta = crearConsultaValida('cita_dev_001');
    await repository.guardar(consulta);

    const encontrada = await repository.buscarPorCitaId(CitaId.crear('cita_dev_001'));
    expect(encontrada).not.toBeNull();
    expect(encontrada?.id.valor).toBe(consulta.id.valor);

    const noExiste = await repository.buscarPorCitaId(CitaId.crear('cita_inexistente_999'));
    expect(noExiste).toBeNull();
  });

  it('7. debe rechazar inserciones concurrentes de la misma citaId lanzando CitaInvalidaParaConsultaError (INV-CONS-07)', async () => {
    const c1 = crearConsultaValida('cita_dev_001');
    const c2 = crearConsultaValida('cita_dev_001'); // Misma cita

    await repository.guardar(c1);

    // El índice único parcial de MongoDB rechaza la segunda inserción con código 11000
    await expect(repository.guardar(c2)).rejects.toThrow(CitaInvalidaParaConsultaError);
  });

  it('8. debe actualizar atómicamente la consulta cuando la versionEsperada coincide', async () => {
    const consulta = crearConsultaValida();
    await repository.guardar(consulta);

    // Modificar datos en sillón (avanza a versión 2)
    const relojPaso2 = new Date('2026-10-22T10:20:00.000Z');
    consulta.actualizarAtencion(
      {
        recomendaciones: 'Recomendación actualizada en sesión',
        actualizadoPor: OdontologoId.crear('od_henry_principal'),
      },
      relojPaso2
    );

    await repository.actualizar(consulta, 1);

    const recuperada = (await repository.buscarPorId(consulta.id))!;
    expect(recuperada.version).toBe(2);
    expect(recuperada.recomendaciones).toBe('Recomendación actualizada en sesión');
    expect(recuperada.actualizadoEn.toISOString()).toBe(relojPaso2.toISOString());
  });

  it('9. debe rechazar actualización lanzando ConflictoConcurrenteConsultaError si la versión persistida no coincide (INV-CONS-09)', async () => {
    const consulta = crearConsultaValida();
    await repository.guardar(consulta);

    // Simular que otro proceso o pestaña actualizó la versión en base de datos
    await model.updateOne({ _id: consulta.id.valor }, { $set: { version: 5 } });

    expect(consulta.version).toBe(1);

    // Intentar actualizar esperando versión 1
    await expect(repository.actualizar(consulta, 1)).rejects.toThrow(ConflictoConcurrenteConsultaError);
  });

  it('10. debe distinguir entre consulta inexistente y conflicto de concurrencia al actualizar', async () => {
    const consultaInexistente = crearConsultaValida();

    await expect(repository.actualizar(consultaInexistente, 1)).rejects.toThrow(ConsultaNoEncontradaError);
  });

  it('11. debe listar consultas paginadas con orden cronológico descendente y desempate estable por _id', async () => {
    const fecha1 = new Date('2026-10-20T10:00:00.000Z');
    const fecha2 = new Date('2026-10-21T10:00:00.000Z');
    const fecha3 = new Date('2026-10-22T10:00:00.000Z');

    const c1 = ConsultaOdontologica.abrir(
      {
        historiaClinicaId: historiaIdBase,
        pacienteId: pacienteIdBase,
        odontologoId: odontologoIdBase,
        versionHistoriaReferenciada: 1,
        snapshotRiesgoClinico: SnapshotRiesgoClinico.vacio(),
        fechaAtencion: fecha1,
        motivoConsulta: MotivoConsulta.crear('Atención día 20'),
      },
      fecha1
    );

    const c2 = ConsultaOdontologica.abrir(
      {
        historiaClinicaId: historiaIdBase,
        pacienteId: pacienteIdBase,
        odontologoId: odontologoIdBase,
        versionHistoriaReferenciada: 1,
        snapshotRiesgoClinico: SnapshotRiesgoClinico.vacio(),
        fechaAtencion: fecha2,
        motivoConsulta: MotivoConsulta.crear('Atención día 21'),
      },
      fecha2
    );

    const c3 = ConsultaOdontologica.abrir(
      {
        historiaClinicaId: historiaIdBase,
        pacienteId: pacienteIdBase,
        odontologoId: odontologoIdBase,
        versionHistoriaReferenciada: 1,
        snapshotRiesgoClinico: SnapshotRiesgoClinico.vacio(),
        fechaAtencion: fecha3,
        motivoConsulta: MotivoConsulta.crear('Atención día 22'),
      },
      fecha3
    );

    await repository.guardar(c1);
    await repository.guardar(c2);
    await repository.guardar(c3);

    // Listar página 1 (límite 2)
    const pagina1 = await repository.listarPorHistoriaClinica(historiaIdBase, 2, 0);
    expect(pagina1.total).toBe(3);
    expect(pagina1.consultas.length).toBe(2);
    // Orden descendente por fecha: c3 (día 22), luego c2 (día 21)
    expect(pagina1.consultas[0].id.valor).toBe(c3.id.valor);
    expect(pagina1.consultas[1].id.valor).toBe(c2.id.valor);

    // Listar página 2 (offset 2, límite 2)
    const pagina2 = await repository.listarPorHistoriaClinica(historiaIdBase, 2, 2);
    expect(pagina2.consultas.length).toBe(1);
    expect(pagina2.consultas[0].id.valor).toBe(c1.id.valor);
  });

  it('12. debe permitir listar por paciente con orden cronológico estable', async () => {
    const c = crearConsultaValida();
    await repository.guardar(c);

    const resultado = await repository.listarPorPacienteId(pacienteIdBase, 10, 0);
    expect(resultado.total).toBe(1);
    expect(resultado.consultas[0].id.valor).toBe(c.id.valor);
  });
});
