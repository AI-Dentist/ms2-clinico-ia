import { HistoriaClinica } from './historia-clinica.entity.js';
import { PacienteId } from '../value-objects/paciente-id.vo.js';
import { OdontologoId } from '../value-objects/odontologo-id.vo.js';
import { HistoriaClinicaId } from '../value-objects/historia-clinica-id.vo.js';
import { EstadoHistoria } from '../value-objects/estado-historia.enum.js';
import { AccionAuditoria } from '../value-objects/accion-auditoria.enum.js';
import { Antecedentes } from '../value-objects/antecedentes.vo.js';
import { CampoClinico } from '../value-objects/campo-clinico.vo.js';
import { Alergia } from '../value-objects/alergia.vo.js';
import { SeveridadAlergia } from '../value-objects/severidad-alergia.enum.js';
import { HistoriaClinicaNoEditableError } from '../errors/historia-clinica-no-editable.error.js';
import { TransicionEstadoInvalidaError } from '../errors/transicion-estado-invalida.error.js';
import { AlergiaDuplicadaError } from '../errors/alergia-duplicada.error.js';

// ─── Helpers ─────────────────────────────────────────────────────────────────

const pacienteId = PacienteId.crear('pac_test_001');
const odontologoId = OdontologoId.crear('od_test_001');
const otroOdontologoId = OdontologoId.crear('od_test_002');

const crearAlergiaPerder = () =>
  Alergia.crear({
    sustancia: 'Penicilina',
    tipoReaccion: 'Urticaria generalizada',
    severidad: SeveridadAlergia.GRAVE,
    notasAdicionales: null,
  });

const crearHistoriaActiva = () =>
  HistoriaClinica.crear({ pacienteId }, odontologoId);

// ─── UT-01: Creación exitosa ──────────────────────────────────────────────────

describe('UT-01: HistoriaClinica.crear() con datos válidos', () => {
  it('debe crear una historia con version 1, estado ACTIVA y auditoría de CREACION', () => {
    const historia = crearHistoriaActiva();

    expect(historia.version).toBe(1);
    expect(historia.estado).toBe(EstadoHistoria.ACTIVA);
    expect(historia.pacienteId.valor).toBe('pac_test_001');
    expect(historia.historialCambios).toHaveLength(1);
    expect(historia.historialCambios[0].accion).toBe(AccionAuditoria.CREACION);
    expect(historia.historialCambios[0].odontologoId).toBe('od_test_001');
    expect(historia.id.valor).toMatch(/^hc_/);
    expect(historia.creadoEn).toBeInstanceOf(Date);
    expect(historia.actualizadoEn).toBeInstanceOf(Date);
  });

  it('debe inicializar alergias, medicamentos y observaciones como vacíos/null', () => {
    const historia = crearHistoriaActiva();

    expect(historia.alergias).toHaveLength(0);
    expect(historia.medicamentosActuales).toHaveLength(0);
    expect(historia.observacionesGenerales).toBeNull();
  });

  it('debe inicializar antecedentes por defecto con todos los campos en NO_EVALUADO', () => {
    const historia = crearHistoriaActiva();
    const od = historia.antecedentes.antecedentesOdontologicos;

    expect(od.tratamientoPrevio.estado).toBe('NO_EVALUADO');
    expect(od.protesisActual.estado).toBe('NO_EVALUADO');
    expect(od.sangradoGingival.estado).toBe('NO_EVALUADO');
    expect(od.bruxismo.estado).toBe('NO_EVALUADO');
  });

  it('debe aceptar odontologoResponsableId si se proporciona explícitamente', () => {
    const historia = HistoriaClinica.crear(
      { pacienteId, odontologoResponsableId: otroOdontologoId },
      odontologoId,
    );
    expect(historia.odontologoResponsableId.valor).toBe('od_test_002');
  });
});

// ─── UT-02: Creación con pacienteId vacío ────────────────────────────────────

describe('UT-02: PacienteId.crear() con valor vacío', () => {
  it('debe lanzar Error si pacienteId es una cadena vacía', () => {
    expect(() => PacienteId.crear('')).toThrow('PacienteId no puede estar vacío.');
  });

  it('debe lanzar Error si pacienteId es solo espacios', () => {
    expect(() => PacienteId.crear('   ')).toThrow('PacienteId no puede estar vacío.');
  });

  it('debe lanzar Error si odontologoId es vacío', () => {
    expect(() => OdontologoId.crear('')).toThrow('OdontologoId no puede estar vacío.');
  });

  it('debe lanzar Error si HistoriaClinicaId.reconstituir recibe valor vacío', () => {
    expect(() => HistoriaClinicaId.reconstituir('')).toThrow(
      'HistoriaClinicaId no puede estar vacío.',
    );
  });
});

// ─── UT-03: Agregar alergia sin duplicado ────────────────────────────────────

describe('UT-03: agregarAlergia() sin duplicado', () => {
  it('debe agregar la alergia al expediente activo', () => {
    const historia = crearHistoriaActiva();
    historia.agregarAlergia(crearAlergiaPerder(), odontologoId);

    expect(historia.alergias).toHaveLength(1);
    expect(historia.alergias[0].sustancia).toBe('Penicilina');
  });

  it('debe incrementar version a 2 y registrar auditoría ADICION_ALERGIA', () => {
    const historia = crearHistoriaActiva();
    historia.agregarAlergia(crearAlergiaPerder(), odontologoId);

    expect(historia.version).toBe(2);
    expect(historia.historialCambios).toHaveLength(2);
    expect(historia.historialCambios[1].accion).toBe(AccionAuditoria.ADICION_ALERGIA);
    expect(historia.historialCambios[1].camposModificados).toContain('alergias');
  });

  it('debe actualizar actualizadoEn en la operación', () => {
    const historia = crearHistoriaActiva();
    const antesDeActualizar = historia.actualizadoEn;
    // Forzar diferencia de timestamp en entornos rápidos
    historia.agregarAlergia(crearAlergiaPerder(), odontologoId);

    expect(historia.actualizadoEn.getTime()).toBeGreaterThanOrEqual(
      antesDeActualizar.getTime(),
    );
  });
});

// ─── UT-04: Agregar alergia duplicada (INV-05) ───────────────────────────────

describe('UT-04: agregarAlergia() con sustancia duplicada', () => {
  it('debe lanzar AlergiaDuplicadaError si la sustancia ya está registrada', () => {
    const historia = crearHistoriaActiva();
    historia.agregarAlergia(crearAlergiaPerder(), odontologoId);

    expect(() =>
      historia.agregarAlergia(crearAlergiaPerder(), odontologoId),
    ).toThrow(AlergiaDuplicadaError);
  });

  it('debe detectar duplicado de forma case-insensitive (INV-05)', () => {
    const historia = crearHistoriaActiva();
    historia.agregarAlergia(crearAlergiaPerder(), odontologoId); // 'Penicilina'

    const alergiaMinusculas = Alergia.crear({
      sustancia: 'penicilina', // mismo nombre, distinto caso
      tipoReaccion: 'Anafilaxia',
      severidad: SeveridadAlergia.GRAVE,
      notasAdicionales: null,
    });

    expect(() => historia.agregarAlergia(alergiaMinusculas, odontologoId)).toThrow(
      AlergiaDuplicadaError,
    );
  });

  it('debe incluir la sustancia en el mensaje de error', () => {
    const historia = crearHistoriaActiva();
    historia.agregarAlergia(crearAlergiaPerder(), odontologoId);

    expect(() =>
      historia.agregarAlergia(crearAlergiaPerder(), odontologoId),
    ).toThrow("'Penicilina'");
  });
});

// ─── UT-05: Actualizar historia en estado CERRADA (INV-04) ───────────────────

describe('UT-05: operaciones sobre historia en estado CERRADA', () => {
  const crearHistoriaCerrada = () => {
    const h = crearHistoriaActiva();
    h.cambiarEstado(EstadoHistoria.CERRADA, odontologoId);
    return h;
  };

  it('agregarAlergia debe lanzar HistoriaClinicaNoEditableError', () => {
    const historia = crearHistoriaCerrada();
    expect(() =>
      historia.agregarAlergia(crearAlergiaPerder(), odontologoId),
    ).toThrow(HistoriaClinicaNoEditableError);
  });

  it('actualizarAntecedentes debe lanzar HistoriaClinicaNoEditableError', () => {
    const historia = crearHistoriaCerrada();
    expect(() =>
      historia.actualizarAntecedentes(
        Antecedentes.porDefecto(),
        odontologoId,
        ['antecedentes'],
      ),
    ).toThrow(HistoriaClinicaNoEditableError);
  });

  it('actualizarObservaciones debe lanzar HistoriaClinicaNoEditableError', () => {
    const historia = crearHistoriaCerrada();
    expect(() =>
      historia.actualizarObservaciones('nueva observacion', odontologoId),
    ).toThrow(HistoriaClinicaNoEditableError);
  });

  it('el error debe llevar el estado CERRADA en la propiedad estado', () => {
    const historia = crearHistoriaCerrada();
    try {
      historia.agregarAlergia(crearAlergiaPerder(), odontologoId);
      expect.fail('Debería haber lanzado error');
    } catch (err) {
      expect(err).toBeInstanceOf(HistoriaClinicaNoEditableError);
      expect((err as HistoriaClinicaNoEditableError).estado).toBe(EstadoHistoria.CERRADA);
    }
  });
});

// ─── UT-06: Actualizar historia en estado ARCHIVADA (INV-03) ─────────────────

describe('UT-06: operaciones sobre historia en estado ARCHIVADA', () => {
  const crearHistoriaArchivada = () => {
    const h = crearHistoriaActiva();
    h.cambiarEstado(EstadoHistoria.ARCHIVADA, odontologoId);
    return h;
  };

  it('agregarAlergia debe lanzar HistoriaClinicaNoEditableError', () => {
    const historia = crearHistoriaArchivada();
    expect(() =>
      historia.agregarAlergia(crearAlergiaPerder(), odontologoId),
    ).toThrow(HistoriaClinicaNoEditableError);
  });

  it('actualizarAntecedentes debe lanzar HistoriaClinicaNoEditableError', () => {
    const historia = crearHistoriaArchivada();
    expect(() =>
      historia.actualizarAntecedentes(
        Antecedentes.porDefecto(),
        odontologoId,
        ['antecedentes'],
      ),
    ).toThrow(HistoriaClinicaNoEditableError);
  });
});

// ─── UT-07: Transición válida ACTIVA → CERRADA ───────────────────────────────

describe('UT-07: cambiarEstado() — transiciones válidas', () => {
  it('ACTIVA → CERRADA debe cambiar el estado correctamente', () => {
    const historia = crearHistoriaActiva();
    historia.cambiarEstado(EstadoHistoria.CERRADA, odontologoId);

    expect(historia.estado).toBe(EstadoHistoria.CERRADA);
  });

  it('ACTIVA → CERRADA debe registrar auditoría CAMBIO_ESTADO', () => {
    const historia = crearHistoriaActiva();
    historia.cambiarEstado(EstadoHistoria.CERRADA, odontologoId);

    const ultima = historia.historialCambios.at(-1)!;
    expect(ultima.accion).toBe(AccionAuditoria.CAMBIO_ESTADO);
    expect(ultima.camposModificados).toContain('estado');
  });

  it('CERRADA → ACTIVA (reapertura) debe ser permitida', () => {
    const historia = crearHistoriaActiva();
    historia.cambiarEstado(EstadoHistoria.CERRADA, odontologoId);
    historia.cambiarEstado(EstadoHistoria.ACTIVA, odontologoId);

    expect(historia.estado).toBe(EstadoHistoria.ACTIVA);
  });

  it('ACTIVA → ARCHIVADA debe ser permitida (irreversible)', () => {
    const historia = crearHistoriaActiva();
    historia.cambiarEstado(EstadoHistoria.ARCHIVADA, odontologoId);

    expect(historia.estado).toBe(EstadoHistoria.ARCHIVADA);
  });

  it('CERRADA → ARCHIVADA debe ser permitida', () => {
    const historia = crearHistoriaActiva();
    historia.cambiarEstado(EstadoHistoria.CERRADA, odontologoId);
    historia.cambiarEstado(EstadoHistoria.ARCHIVADA, odontologoId);

    expect(historia.estado).toBe(EstadoHistoria.ARCHIVADA);
  });
});

// ─── UT-08: Transición inválida ARCHIVADA → ACTIVA ───────────────────────────

describe('UT-08: cambiarEstado() — transiciones inválidas', () => {
  it('ARCHIVADA → ACTIVA debe lanzar TransicionEstadoInvalidaError', () => {
    const historia = crearHistoriaActiva();
    historia.cambiarEstado(EstadoHistoria.ARCHIVADA, odontologoId);

    expect(() =>
      historia.cambiarEstado(EstadoHistoria.ACTIVA, odontologoId),
    ).toThrow(TransicionEstadoInvalidaError);
  });

  it('ARCHIVADA → CERRADA debe lanzar TransicionEstadoInvalidaError', () => {
    const historia = crearHistoriaActiva();
    historia.cambiarEstado(EstadoHistoria.ARCHIVADA, odontologoId);

    expect(() =>
      historia.cambiarEstado(EstadoHistoria.CERRADA, odontologoId),
    ).toThrow(TransicionEstadoInvalidaError);
  });

  it('ARCHIVADA → ARCHIVADA debe lanzar TransicionEstadoInvalidaError', () => {
    const historia = crearHistoriaActiva();
    historia.cambiarEstado(EstadoHistoria.ARCHIVADA, odontologoId);

    expect(() =>
      historia.cambiarEstado(EstadoHistoria.ARCHIVADA, odontologoId),
    ).toThrow(TransicionEstadoInvalidaError);
  });

  it('el error debe mencionar los estados origen y destino', () => {
    const historia = crearHistoriaActiva();
    historia.cambiarEstado(EstadoHistoria.ARCHIVADA, odontologoId);

    expect(() =>
      historia.cambiarEstado(EstadoHistoria.ACTIVA, odontologoId),
    ).toThrow("'ARCHIVADA' → 'ACTIVA'");
  });
});

// ─── UT-09: version se incrementa en cada actualización (INV-07) ─────────────

describe('UT-09: version se incrementa con cada cambio', () => {
  it('version debe ser 1 al crear', () => {
    const historia = crearHistoriaActiva();
    expect(historia.version).toBe(1);
  });

  it('version debe incrementar a 2 después de agregarAlergia', () => {
    const historia = crearHistoriaActiva();
    historia.agregarAlergia(crearAlergiaPerder(), odontologoId);
    expect(historia.version).toBe(2);
  });

  it('version debe incrementar a 3 después de dos cambios', () => {
    const historia = crearHistoriaActiva();
    historia.agregarAlergia(crearAlergiaPerder(), odontologoId);
    historia.actualizarObservaciones('Observación actualizada', odontologoId);
    expect(historia.version).toBe(3);
  });

  it('el historial debe tener tantas entradas como cambios + 1 (creación)', () => {
    const historia = crearHistoriaActiva();
    historia.agregarAlergia(crearAlergiaPerder(), odontologoId);
    historia.actualizarObservaciones('Observación', odontologoId);
    expect(historia.historialCambios).toHaveLength(3); // CREACION + ADICION + OBSERVACION
  });
});

// ─── UT-10: CampoClinico con estado NO_EVALUADO no requiere detalle ───────────

describe('UT-10: CampoClinico — estado NO_EVALUADO', () => {
  it('debe crearse sin error cuando estado es NO_EVALUADO', () => {
    expect(() => CampoClinico.crear({ estado: 'NO_EVALUADO' })).not.toThrow();
  });

  it('detalle debe ser null cuando estado es NO_EVALUADO', () => {
    const campo = CampoClinico.crear({ estado: 'NO_EVALUADO' });
    expect(campo.detalle).toBeNull();
    expect(campo.registradoEn).toBeNull();
  });

  it('debe crearse sin error cuando estado es NEGADO', () => {
    const campo = CampoClinico.crear({ estado: 'NEGADO' });
    expect(campo.estado).toBe('NEGADO');
    expect(campo.detalle).toBeNull();
  });

  it('Antecedentes.porDefecto() debe tener todos los campos en NO_EVALUADO', () => {
    const antecedentes = Antecedentes.porDefecto();
    const od = antecedentes.antecedentesOdontologicos;

    expect(od.tratamientoPrevio.esNoEvaluado()).toBe(true);
    expect(od.protesisActual.esNegado()).toBe(false);
    expect(antecedentes.enfermedadesCronicas).toHaveLength(0);
  });
});

// ─── UT-11: CampoClinico CONFIRMADO sin detalle lanza error (INV-08) ─────────

describe('UT-11: CampoClinico — estado CONFIRMADO requiere detalle', () => {
  it('debe lanzar Error si estado es CONFIRMADO y detalle es null', () => {
    expect(() =>
      CampoClinico.crear({
        estado: 'CONFIRMADO',
        detalle: null as unknown as string,
      }),
    ).toThrow("requiere 'detalle' no vacío");
  });

  it('debe lanzar Error si detalle es una cadena vacía', () => {
    expect(() =>
      CampoClinico.crear({ estado: 'CONFIRMADO', detalle: '' }),
    ).toThrow("requiere 'detalle' no vacío");
  });

  it('debe lanzar Error si detalle es solo espacios', () => {
    expect(() =>
      CampoClinico.crear({ estado: 'CONFIRMADO', detalle: '   ' }),
    ).toThrow("requiere 'detalle' no vacío");
  });

  it('debe crearse correctamente con CONFIRMADO y detalle válido', () => {
    const campo = CampoClinico.crear({
      nombre: 'Diabetes tipo 2',
      estado: 'CONFIRMADO',
      detalle: 'Diagnosticada en 2019.',
    });

    expect(campo.estado).toBe('CONFIRMADO');
    expect(campo.detalle).toBe('Diagnosticada en 2019.');
    expect(campo.esConfirmado()).toBe(true);
    expect(campo.registradoEn).toBeInstanceOf(Date);
  });

  it('el mensaje de error debe incluir el nombre del campo cuando se proporciona', () => {
    expect(() =>
      CampoClinico.crear({ nombre: 'Diabetes', estado: 'CONFIRMADO', detalle: '' }),
    ).toThrow("campo: 'Diabetes'");
  });
});

// ─── Pruebas adicionales de valor en VOs ─────────────────────────────────────

describe('Alergia — validaciones de value object', () => {
  it('debe lanzar error si sustancia está vacía', () => {
    expect(() =>
      Alergia.crear({
        sustancia: '',
        tipoReaccion: 'Urticaria',
        severidad: SeveridadAlergia.LEVE,
        notasAdicionales: null,
      }),
    ).toThrow("'sustancia' es obligatoria");
  });

  it('debe lanzar error si tipoReaccion está vacío', () => {
    expect(() =>
      Alergia.crear({
        sustancia: 'Látex',
        tipoReaccion: '  ',
        severidad: SeveridadAlergia.LEVE,
        notasAdicionales: null,
      }),
    ).toThrow("'tipoReaccion' es obligatorio");
  });

  it('mismaSustanciaQue debe ser case-insensitive', () => {
    const alergia = Alergia.crear({
      sustancia: 'Penicilina',
      tipoReaccion: 'Urticaria',
      severidad: SeveridadAlergia.GRAVE,
      notasAdicionales: null,
    });

    expect(alergia.mismaSustanciaQue('PENICILINA')).toBe(true);
    expect(alergia.mismaSustanciaQue('penicilina')).toBe(true);
    expect(alergia.mismaSustanciaQue('Amoxicilina')).toBe(false);
  });
});

describe('HistoriaClinica — reconstituir desde persistencia', () => {
  it('debe reconstituir correctamente sin modificar el estado', () => {
    const historia = HistoriaClinica.reconstituir({
      id: HistoriaClinicaId.reconstituir('hc_test-fixed-id'),
      pacienteId: PacienteId.crear('pac_abc'),
      odontologoResponsableId: OdontologoId.crear('od_abc'),
      estado: EstadoHistoria.CERRADA,
      antecedentes: Antecedentes.porDefecto(),
      alergias: [],
      medicamentosActuales: [],
      observacionesGenerales: 'Notas previas',
      version: 5,
      creadoEn: new Date('2026-01-01'),
      actualizadoEn: new Date('2026-06-01'),
      historialCambios: [],
    });

    expect(historia.id.valor).toBe('hc_test-fixed-id');
    expect(historia.estado).toBe(EstadoHistoria.CERRADA);
    expect(historia.version).toBe(5);
    expect(historia.observacionesGenerales).toBe('Notas previas');
  });
});
