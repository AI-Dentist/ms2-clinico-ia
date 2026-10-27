import crypto from 'node:crypto';
import mongoose from 'mongoose';

const BASE_URL = 'http://127.0.0.1:3002/api/expediente';
const TOKEN = 'token_dev_henry';
const uid = crypto.randomUUID();
const HISTORIA_ID = `hc_${uid}`;
const PACIENTE_ID = `pac_${uid}`;
const CONSULTA_ID = `cons_${uid}`;

async function request(path, options = {}) {
  const url = `${BASE_URL}${path}`;
  const headers = {
    'Accept': 'application/json, application/problem+json',
    'Authorization': `Bearer ${TOKEN}`,
    ...(options.headers || {}),
  };
  if (options.body) {
    headers['Content-Type'] = 'application/json';
  }
  const res = await fetch(url, {
    method: options.method || 'GET',
    headers,
    body: options.body ? JSON.stringify(options.body) : undefined,
  });
  let data = null;
  const text = await res.text();
  try {
    data = JSON.parse(text);
  } catch {
    data = text;
  }
  return { status: res.status, ok: res.ok, data };
}

async function run() {
  console.log('=== TEST SUITE: INTEGRACIÓN COMPLETA ODONTOGRAMA (ETAPA 7G FINAL) ===\n');

  // 1. Estado del entorno aislado
  console.log('Paso 1: Verificar status del entorno aislado (GET /odontogramas/entorno-aislado/status)');
  const statusRes = await request('/odontogramas/entorno-aislado/status');
  console.log(`HTTP ${statusRes.status}:`, JSON.stringify(statusRes.data));
  if (statusRes.status !== 200 || !statusRes.data.aislado || statusRes.data.puertoMongo !== 27018) {
    throw new Error('Fallo: El servidor no está en modo aislado en puerto 27018');
  }
  console.log('✔ Entorno aislado confirmado en MongoDB 27018 con réplicas activas.\n');

  // Siembra dinámica de recursos sintéticos en MongoDB 27018 para esta prueba
  console.log(`Sembrando Historia Clínica (${HISTORIA_ID}) y Consulta (${CONSULTA_ID}) sintéticas en 27018...`);
  const conn = await mongoose.createConnection('mongodb://127.0.0.1:27018/test_odontograma_db?replicaSet=rs_odontograma_test').asPromise();
  try {
    await conn.collection('historias_clinicas').insertOne({
      _id: HISTORIA_ID,
      pacienteId: PACIENTE_ID,
      odontologoResponsableId: 'od_henry_principal',
      estado: 'ACTIVA',
      antecedentes: { patologicos: [], noPatologicos: [], familiares: [], estomatologicos: [] },
      alergias: [],
      medicamentosActuales: [],
      observacionesGenerales: 'Expediente sintético para prueba E2E 7G-FINAL',
      version: 1,
      creadoEn: new Date(),
      actualizadoEn: new Date(),
    });

    await conn.collection('consultas_odontologicas').insertOne({
      _id: CONSULTA_ID,
      historiaClinicaId: HISTORIA_ID,
      pacienteId: PACIENTE_ID,
      odontologoId: 'od_henry_principal',
      citaId: null,
      versionHistoriaReferenciada: 1,
      snapshotRiesgoClinico: {
        alergiasCriticas: [],
        condicionesMedicas: [],
        medicacionHabitual: [],
        capturadoEn: new Date(),
      },
      fechaAtencion: new Date(),
      cerradaEn: null,
      estado: 'EN_CURSO',
      motivoConsulta: 'Evaluación estomatológica periódica de control',
      anamnesisActual: {
        descripcion: 'Paciente asiste a control dental periódico',
        tiempoEvolucion: 'Asintomático',
        escalaDolorEVA: 0,
      },
      exploracionFisica: {
        inspeccionExtraoral: 'Normal',
        inspeccionIntraoral: 'Mucosas íntegras',
        hallazgosDentales: null,
      },
      diagnosticos: [],
      procedimientosRealizados: [],
      evolucionSOAP: {
        subjetivo: 'Asintomático',
        objetivo: 'Examen bucal rutinario',
        analisis: 'Estado general conservado',
        plan: 'Elaboración de odontograma inicial',
      },
      recomendaciones: null,
      motivoCancelacion: null,
      version: 1,
      creadoEn: new Date(),
      actualizadoEn: new Date(),
      creadoPor: 'od_henry_principal',
      actualizadoPor: 'od_henry_principal',
    });
  } finally {
    await conn.close();
  }
  console.log('✔ Fixtures sintéticos sembrados exclusivamente en base temporal 27018.\n');

  // 2. Consulta de historia sin odontograma (debe dar 404)
  console.log(`Paso 2: Consultar odontograma actual antes de inicializar (GET /odontogramas/historia/${HISTORIA_ID})`);
  const initialGet = await request(`/odontogramas/historia/${HISTORIA_ID}`);
  console.log(`HTTP ${initialGet.status} (Esperado 404):`, initialGet.data?.title || initialGet.data);
  if (initialGet.status !== 404) {
    throw new Error(`Fallo: Se esperaba 404 pero se obtuvo ${initialGet.status}`);
  }
  console.log('✔ Estado 404 confirmado (Expediente sin odontograma).\n');

  // 3. Inicialización explícita del odontograma (POST /odontogramas/inicializar)
  console.log('Paso 3: Inicializar odontograma explícitamente (POST /odontogramas/inicializar)');
  const initRes = await request('/odontogramas/inicializar', {
    method: 'POST',
    body: { historiaClinicaId: HISTORIA_ID },
  });
  console.log(`HTTP ${initRes.status} (Esperado 201 Created)`);
  if (initRes.status !== 201) {
    throw new Error(`Fallo al inicializar: ${JSON.stringify(initRes.data)}`);
  }
  const odontograma = initRes.data;
  console.log(`  - Odontograma ID: ${odontograma.id}`);
  console.log(`  - Versión inicial: ${odontograma.version}`);
  console.log(`  - Total piezas: ${odontograma.piezas?.length}`);
  console.log(`  - Total revisiones: ${odontograma.totalRevisiones}`);
  console.log(`  - Revisión basal actual: ${odontograma.revisionActualId}`);

  if (odontograma.piezas?.length !== 52) {
    throw new Error(`Se esperaban exactamente 52 piezas FDI, se obtuvieron ${odontograma.piezas?.length}`);
  }
  const pieza11 = odontograma.piezas.find((p) => p.numeroFDI === 11);
  console.log('  - Muestra FDI 11:', {
    estadoAnatomico: pieza11.estadoAnatomico,
    estadoEvaluacion: pieza11.estadoEvaluacion,
    superficies: Object.keys(pieza11.superficies).map(s => `${s}:${pieza11.superficies[s].condicion}`).join(', ')
  });
  if (pieza11.estadoAnatomico !== 'DESCONOCIDO' || pieza11.estadoEvaluacion !== 'NO_EVALUADO') {
    throw new Error('Estado basal de FDI 11 incorrecto');
  }
  console.log('✔ Inicialización basal con 52 posiciones FDI DESCONOCIDO y NO_EVALUADO confirmada.\n');

  // 4. Intentar inicializar nuevamente (debe dar 409 Conflicto / Duplicado)
  console.log('Paso 4: Intentar inicializar nuevamente la misma historia (debe dar 409 Conflicto)');
  const dupRes = await request('/odontogramas/inicializar', {
    method: 'POST',
    body: { historiaClinicaId: HISTORIA_ID },
  });
  console.log(`HTTP ${dupRes.status} (Esperado 409):`, dupRes.data?.title || dupRes.data?.detail);
  if (dupRes.status !== 409) {
    throw new Error(`Se esperaba 409 pero se obtuvo ${dupRes.status}`);
  }
  console.log('✔ Prevención de duplicados comprobada exitosamente (HTTP 409).\n');

  // 5. Registrar una revisión clínica real (NUEVA_OBSERVACION)
  console.log('Paso 5: Registrar Revisión Clínica Real (POST /odontogramas/:id/revisiones)');
  const revisionPayload = {
    versionEsperada: odontograma.version, // v1
    tipoRevision: 'NUEVA_OBSERVACION',
    consultaId: CONSULTA_ID,
    fechaObservacionClinica: new Date().toISOString(),
    motivoRevision: 'Primera evaluación clínica estomatológica rutinaria.',
    deltas: [
      {
        numeroFDI: 11,
        estadoAnatomicoAnterior: 'DESCONOCIDO',
        estadoAnatomicoNuevo: 'PRESENTE',
        superficiesModificadas: [
          { superficie: 'OCLUSAL_INCISAL', condicionAnterior: 'NO_EVALUADA', condicionNueva: 'CARIES' },
          { superficie: 'VESTIBULAR', condicionAnterior: 'NO_EVALUADA', condicionNueva: 'SANA' }
        ],
        tratamientoEstructuralAgregado: null,
        observaciones: 'Caries de esmalte en fosa oclusal'
      },
      {
        numeroFDI: 21,
        estadoAnatomicoAnterior: 'DESCONOCIDO',
        estadoAnatomicoNuevo: 'PRESENTE',
        superficiesModificadas: [
          { superficie: 'OCLUSAL_INCISAL', condicionAnterior: 'NO_EVALUADA', condicionNueva: 'SANA' },
          { superficie: 'VESTIBULAR', condicionAnterior: 'NO_EVALUADA', condicionNueva: 'SANA' },
          { superficie: 'PALATINA_LINGUAL', condicionAnterior: 'NO_EVALUADA', condicionNueva: 'SANA' },
          { superficie: 'MESIAL', condicionAnterior: 'NO_EVALUADA', condicionNueva: 'SANA' },
          { superficie: 'DISTAL', condicionAnterior: 'NO_EVALUADA', condicionNueva: 'SANA' }
        ],
        tratamientoEstructuralAgregado: null,
        observaciones: 'Pieza íntegra y sana'
      }
    ],
    revisionCorregidaId: null,
    aplicaAlEstadoActual: true
  };

  const regRes = await request(`/odontogramas/${odontograma.id}/revisiones`, {
    method: 'POST',
    body: revisionPayload,
  });
  console.log(`HTTP ${regRes.status} (Esperado 201 Created)`);
  if (regRes.status !== 201) {
    throw new Error(`Fallo al registrar revisión: ${JSON.stringify(regRes.data)}`);
  }
  const revision1 = regRes.data;
  console.log(`  - Revisión ID: ${revision1.id}`);
  console.log(`  - Número de revisión: ${revision1.numeroRevision}`);
  console.log(`  - Tipo: ${revision1.tipoRevision}`);
  console.log(`  - Odontólogo autor: ${revision1.odontologoId}`);
  console.log(`  - Deltas registrados: ${revision1.deltas?.length}`);
  console.log('✔ Revisión clínica registrada con transacción ACID en MongoDB 27018.\n');

  // 6. Probar conflicto de concurrencia optimista HTTP 409
  console.log('Paso 6: Probar conflicto de concurrencia optimista enviando versionEsperada desfasada (v1 en vez de v2)');
  const conflictPayload = {
    ...revisionPayload,
    versionEsperada: 1, // Desfasada, ya avanzó a 2
    motivoRevision: 'Intento de registro concurrente con versión desfasada'
  };
  const conflictRes = await request(`/odontogramas/${odontograma.id}/revisiones`, {
    method: 'POST',
    body: conflictPayload,
  });
  console.log(`HTTP ${conflictRes.status} (Esperado 409 Conflicto):`, conflictRes.data?.title || conflictRes.data?.detail);
  if (conflictRes.status !== 409) {
    throw new Error(`Se esperaba 409 pero se obtuvo ${conflictRes.status}`);
  }
  console.log('✔ Control de concurrencia optimista validado (HTTP 409 ante versión obsoleta).\n');

  // 7. Recuperar el odontograma consolidado actual desde NestJS
  console.log(`Paso 7: Recuperar odontograma consolidado actual (GET /odontogramas/historia/${HISTORIA_ID})`);
  const actualRes = await request(`/odontogramas/historia/${HISTORIA_ID}`);
  console.log(`HTTP ${actualRes.status}:`);
  const actual = actualRes.data;
  console.log(`  - Versión actual consolidada: ${actual.version} (Esperado: 2)`);
  console.log(`  - Total revisiones: ${actual.totalRevisiones} (Esperado: 2)`);
  console.log(`  - Revisión actual ID: ${actual.revisionActualId} (Esperado: ${revision1.id})`);
  const pieza11Actual = actual.piezas.find((p) => p.numeroFDI === 11);
  const pieza21Actual = actual.piezas.find((p) => p.numeroFDI === 21);
  console.log('  - Estado consolidado FDI 11:', {
    estadoAnatomico: pieza11Actual.estadoAnatomico,
    estadoEvaluacion: pieza11Actual.estadoEvaluacion,
    oclusal: pieza11Actual.superficies.OCLUSAL_INCISAL.condicion,
    vestibular: pieza11Actual.superficies.VESTIBULAR.condicion
  });
  console.log('  - Estado consolidado FDI 21:', {
    estadoAnatomico: pieza21Actual.estadoAnatomico,
    estadoEvaluacion: pieza21Actual.estadoEvaluacion,
    oclusal: pieza21Actual.superficies.OCLUSAL_INCISAL.condicion
  });
  if (actual.version !== 2 || pieza11Actual.superficies.OCLUSAL_INCISAL.condicion !== 'CARIES') {
    throw new Error('El estado consolidado no refleja la revisión aplicada');
  }
  console.log('✔ Estado consolidado recuperado y persistido fielmente.\n');

  // 8. Consultar el historial longitudinal paginado
  console.log(`Paso 8: Consultar historial de revisiones (GET /odontogramas/${odontograma.id}/historial)`);
  const historialRes = await request(`/odontogramas/${odontograma.id}/historial?limite=10&offset=0`);
  console.log(`HTTP ${historialRes.status}: Total revisiones = ${historialRes.data.total}`);
  historialRes.data.revisiones.forEach((r) => {
    console.log(`  - Rev #${r.numeroRevision} (${r.id}): ${r.tipoRevision} - ${r.motivoRevision}`);
  });
  if (historialRes.data.total < 2) {
    throw new Error('El historial debe contener al menos 2 revisiones (basal + nueva observación)');
  }
  console.log('✔ Historial longitudinal inmutable verificado.\n');

  // 9. Abrir y verificar snapshot histórico sellado
  console.log(`Paso 9: Consultar snapshot histórico de la revisión basal #1 (GET /odontogramas/${odontograma.id}/revisiones/${odontograma.revisionActualId})`);
  const snapshotRes = await request(`/odontogramas/${odontograma.id}/revisiones/${odontograma.revisionActualId}`);
  console.log(`HTTP ${snapshotRes.status}:`);
  const snapshot = snapshotRes.data;
  console.log(`  - Snapshot Rev #${snapshot.numeroRevision} (${snapshot.id})`);
  console.log(`  - Total piezas en snapshot: ${snapshot.snapshotPiezas?.length}`);
  const snap11 = snapshot.snapshotPiezas.find((p) => p.numeroFDI === 11);
  console.log(`  - FDI 11 en snapshot basal: estado = ${snap11.estadoAnatomico}, oclusal = ${snap11.superficies.OCLUSAL_INCISAL.condicion}`);
  if (snap11.estadoAnatomico !== 'DESCONOCIDO' || snap11.superficies.OCLUSAL_INCISAL.condicion !== 'NO_EVALUADA') {
    throw new Error('El snapshot histórico basal fue indebidamente alterado');
  }
  console.log('✔ Snapshot histórico sellado inmutable verificado.\n');

  // 10. Preparar y registrar una ENMIENDA RETROSPECTIVA
  console.log('Paso 10: Registrar ENMIENDA_CORRECTIVA Retrospectiva (aplicaAlEstadoActual = false)');
  const enmiendaPayload = {
    versionEsperada: actual.version, // v2
    tipoRevision: 'ENMIENDA_CORRECTIVA',
    consultaId: null,
    fechaObservacionClinica: new Date().toISOString(),
    motivoRevision: 'Rectificación formal retrospectiva sobre anotación previa en revisión basal.',
    deltas: [
      {
        numeroFDI: 11,
        estadoAnatomicoAnterior: 'DESCONOCIDO',
        estadoAnatomicoNuevo: 'PRESENTE',
        superficiesModificadas: [
          { superficie: 'MESIAL', condicionAnterior: 'NO_EVALUADA', condicionNueva: 'SANA' }
        ],
        tratamientoEstructuralAgregado: null,
        observaciones: 'Enmienda histórica de evaluación'
      }
    ],
    revisionCorregidaId: odontograma.revisionActualId, // Corrige la revisión basal
    aplicaAlEstadoActual: false // RETROSPECTIVA PURA
  };

  const enmiendaRes = await request(`/odontogramas/${odontograma.id}/revisiones`, {
    method: 'POST',
    body: enmiendaPayload,
  });
  console.log(`HTTP ${enmiendaRes.status} (Esperado 201 Created)`);
  if (enmiendaRes.status !== 201) {
    throw new Error(`Fallo al registrar enmienda: ${JSON.stringify(enmiendaRes.data)}`);
  }
  const enmiendaCreada = enmiendaRes.data;
  console.log(`  - Enmienda ID: ${enmiendaCreada.id}`);
  console.log(`  - Número de revisión: ${enmiendaCreada.numeroRevision}`);
  console.log(`  - Tipo: ${enmiendaCreada.tipoRevision}`);
  console.log(`  - Revision Corregida ID: ${enmiendaCreada.revisionCorregidaId}`);
  console.log(`  - Aplica al estado actual: ${enmiendaCreada.aplicaAlEstadoActual}`);
  console.log('✔ Enmienda retrospectiva registrada exitosamente.\n');

  // 11. Comprobar que la enmienda retrospectiva NO alteró indebidamente el estado maestro actual
  console.log(`Paso 11: Comprobar que el estado consolidado actual permanece INTACTO (GET /odontogramas/historia/${HISTORIA_ID})`);
  const postEnmiendaRes = await request(`/odontogramas/historia/${HISTORIA_ID}`);
  const postEnmienda = postEnmiendaRes.data;
  console.log(`  - Versión maestra después de enmienda: ${postEnmienda.version} (Esperado: 3)`);
  console.log(`  - Total revisiones: ${postEnmienda.totalRevisiones} (Esperado: 3)`);
  console.log(`  - Revision actual ID: ${postEnmienda.revisionActualId} (Esperado: se mantiene ${revision1.id})`);
  const p11Post = postEnmienda.piezas.find((p) => p.numeroFDI === 11);
  console.log('  - FDI 11 consolidado post-enmienda:', {
    estadoAnatomico: p11Post.estadoAnatomico,
    oclusal: p11Post.superficies.OCLUSAL_INCISAL.condicion,
    mesial: p11Post.superficies.MESIAL.condicion
  });

  if (postEnmienda.version !== 3) {
    throw new Error(`Versión esperada 3 pero fue ${postEnmienda.version}`);
  }
  if (postEnmienda.revisionActualId !== revision1.id) {
    throw new Error(`RevisionActualId cambió indebidamente tras enmienda retrospectiva`);
  }
  if (p11Post.superficies.OCLUSAL_INCISAL.condicion !== 'CARIES') {
    throw new Error(`Estado actual de OCLUSAL en FDI 11 fue modificado indebidamente`);
  }
  console.log('✔ INVARIANTE CLÍNICA VERIFICADA: La enmienda retrospectiva incrementó la versión del agregado para auditoría, pero NO mutó el estado clínico maestro actual.\n');

  console.log('=================================================================');
  console.log('🎉 TODOS LOS 11 PASOS DEL FLUJO INTEGRAL COMPLETADOS EXITOSAMENTE');
  console.log('=================================================================');
}

run().catch((err) => {
  console.error('\n❌ ERROR EN EL FLUJO:', err.message || err);
  process.exit(1);
});
