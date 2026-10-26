import { describe, it, expect, vi, beforeEach } from 'vitest';
import { RegistrarRevisionOdontogramaUseCase } from './registrar-revision-odontograma.use-case.js';
import type { IOdontogramaRepositoryPort } from '../../domain/ports/odontograma.repository.port.js';
import type { IHistoriaClinicaContextPort } from '../ports/historia-clinica-context.port.js';
import type { IConsultaOdontologicaContextPort } from '../ports/consulta-odontologica-context.port.js';
import type { IOdontologoContextPort } from '../ports/odontologo-context.port.js';
import { Odontograma } from '../../domain/entities/odontograma.entity.js';
import { HistoriaClinicaId } from '../../../historias-clinicas/domain/value-objects/historia-clinica-id.vo.js';
import { PacienteId } from '../../../historias-clinicas/domain/value-objects/paciente-id.vo.js';
import { OdontologoId } from '../../../historias-clinicas/domain/value-objects/odontologo-id.vo.js';
import { ConsultaId } from '../../../consultas-odontologicas/domain/value-objects/consulta-id.vo.js';
import { OdontogramaId } from '../../domain/value-objects/odontograma-id.vo.js';
import { RevisionId } from '../../domain/value-objects/revision-id.vo.js';
import { OdontogramaNoEncontradoError } from '../../domain/errors/odontograma-no-encontrado.error.js';
import { ConsultaInvalidaError } from '../errors/consulta-invalida.error.js';
import { RevisionInvalidaError } from '../errors/revision-invalida.error.js';
import { EnmiendaCorrectivaInvalidaError } from '../../domain/errors/enmienda-correctiva-invalida.error.js';
import { ConflictoConcurrenteOdontogramaError } from '../../domain/errors/conflicto-concurrente-odontograma.error.js';

type MockOdontogramaRepository = {
  [K in keyof IOdontogramaRepositoryPort]: ReturnType<typeof vi.fn>;
};

type MockHistoriaClinicaContext = {
  [K in keyof IHistoriaClinicaContextPort]: ReturnType<typeof vi.fn>;
};

type MockConsultaContext = {
  [K in keyof IConsultaOdontologicaContextPort]: ReturnType<typeof vi.fn>;
};

type MockOdontologoContext = {
  [K in keyof IOdontologoContextPort]: ReturnType<typeof vi.fn>;
};

describe('RegistrarRevisionOdontogramaUseCase', () => {
  let useCase: RegistrarRevisionOdontogramaUseCase;
  let mockOdontogramaRepository: MockOdontogramaRepository;
  let mockHistoriaClinicaContext: MockHistoriaClinicaContext;
  let mockConsultaContext: MockConsultaContext;
  let mockOdontologoContext: MockOdontologoContext;

  const historiaClinicaIdValida = 'hc_12345678-1234-1234-1234-123456789abc';
  const pacienteIdReal = 'pac_87654321-4321-4321-4321-abcdef123456';
  const odontologoIdMock = 'od_henry_principal';
  const consultaIdValida = ConsultaId.generar().valor;

  let odontogramaTest: Odontograma;
  let revisionBasalTest: any;

  beforeEach(() => {
    const { odontograma, revisionBasal } = Odontograma.inicializar({
      historiaClinicaId: HistoriaClinicaId.reconstituir(historiaClinicaIdValida),
      pacienteId: PacienteId.crear(pacienteIdReal),
      odontologoId: OdontologoId.crear(odontologoIdMock),
    });
    odontogramaTest = odontograma;
    revisionBasalTest = revisionBasal;

    mockOdontogramaRepository = {
      guardarInicial: vi.fn(),
      aplicarRevisionTransaccional: vi.fn().mockResolvedValue(undefined),
      buscarPorId: vi.fn().mockResolvedValue(odontogramaTest),
      buscarPorHistoriaClinicaId: vi.fn().mockResolvedValue(odontogramaTest),
      buscarRevisionPorId: vi.fn().mockResolvedValue(revisionBasalTest),
      listarRevisiones: vi.fn(),
      listarRevisionesPorConsultaId: vi.fn(),
    };

    mockHistoriaClinicaContext = {
      obtenerResumenHistoria: vi.fn().mockResolvedValue({
        existe: true,
        pacienteId: pacienteIdReal,
        estado: 'ACTIVA',
      }),
    };

    mockConsultaContext = {
      obtenerResumenConsulta: vi.fn().mockResolvedValue({
        existe: true,
        historiaClinicaId: historiaClinicaIdValida,
        pacienteId: pacienteIdReal,
        estado: 'EN_CURSO',
      }),
    };

    mockOdontologoContext = {
      obtenerOdontologoActual: vi.fn().mockResolvedValue({
        odontologoId: odontologoIdMock,
      }),
    };

    useCase = new RegistrarRevisionOdontogramaUseCase(
      mockOdontogramaRepository as unknown as IOdontogramaRepositoryPort,
      mockHistoriaClinicaContext as unknown as IHistoriaClinicaContextPort,
      mockConsultaContext as unknown as IConsultaOdontologicaContextPort,
      mockOdontologoContext as unknown as IOdontologoContextPort
    );
  });

  it('8. debe registrar exitosamente una nueva observación clínica válida con deltas', async () => {
    const resultado = await useCase.ejecutar({
      odontogramaId: odontogramaTest.id.valor,
      versionEsperada: 1,
      tipoRevision: 'NUEVA_OBSERVACION',
      consultaId: consultaIdValida,
      fechaObservacionClinica: new Date('2026-10-25T11:00:00.000Z'),
      motivoRevision: 'Detección clínica de caries oclusal en molar 16',
      deltas: [
        {
          numeroFDI: 16,
          estadoAnatomicoNuevo: 'PRESENTE',
          superficiesModificadas: [
            {
              superficie: 'OCLUSAL_INCISAL',
              condicionAnterior: 'NO_EVALUADA',
              condicionNueva: 'CARIES',
            },
          ],
        },
      ],
    });

    expect(resultado).toBeDefined();
    expect(resultado.numeroRevision).toBe(2);
    expect(resultado.tipoRevision).toBe('NUEVA_OBSERVACION');
    expect(resultado.consultaId).toBe(consultaIdValida);
    expect(resultado.aplicaAlEstadoActual).toBe(true);
    expect(resultado.cambiosAplicados.length).toBe(1);

    expect(mockOdontogramaRepository.aplicarRevisionTransaccional).toHaveBeenCalledTimes(1);
    expect(odontogramaTest.version).toBe(2);
    expect(odontogramaTest.obtenerPieza(16).estadoAnatomico).toBe('PRESENTE');
  });

  it('9. debe rechazar el registro si la consulta indicada no existe en el sistema', async () => {
    mockConsultaContext.obtenerResumenConsulta.mockResolvedValueOnce(null);

    await expect(
      useCase.ejecutar({
        odontogramaId: odontogramaTest.id.valor,
        versionEsperada: 1,
        tipoRevision: 'NUEVA_OBSERVACION',
        consultaId: consultaIdValida,
        fechaObservacionClinica: new Date(),
        motivoRevision: 'Revisión con consulta inexistente',
        deltas: [],
      })
    ).rejects.toThrow(ConsultaInvalidaError);
  });

  it('10. debe rechazar el registro si la consulta pertenece a otro paciente', async () => {
    mockConsultaContext.obtenerResumenConsulta.mockResolvedValueOnce({
      existe: true,
      historiaClinicaId: historiaClinicaIdValida,
      pacienteId: 'pac_otro_paciente_diferente',
      estado: 'EN_CURSO',
    });

    await expect(
      useCase.ejecutar({
        odontogramaId: odontogramaTest.id.valor,
        versionEsperada: 1,
        tipoRevision: 'NUEVA_OBSERVACION',
        consultaId: consultaIdValida,
        fechaObservacionClinica: new Date(),
        motivoRevision: 'Revisión con paciente cruzado',
        deltas: [],
      })
    ).rejects.toThrow(ConsultaInvalidaError);
  });

  it('11. debe rechazar el registro si la consulta pertenece a otra historia clínica', async () => {
    mockConsultaContext.obtenerResumenConsulta.mockResolvedValueOnce({
      existe: true,
      historiaClinicaId: 'hc_otra_historia_diferente',
      pacienteId: pacienteIdReal,
      estado: 'EN_CURSO',
    });

    await expect(
      useCase.ejecutar({
        odontogramaId: odontogramaTest.id.valor,
        versionEsperada: 1,
        tipoRevision: 'NUEVA_OBSERVACION',
        consultaId: consultaIdValida,
        fechaObservacionClinica: new Date(),
        motivoRevision: 'Revisión con historia clínica cruzada',
        deltas: [],
      })
    ).rejects.toThrow(ConsultaInvalidaError);
  });

  it('12. debe rechazar el registro si la consulta ya está COMPLETADA o CANCELADA', async () => {
    mockConsultaContext.obtenerResumenConsulta.mockResolvedValueOnce({
      existe: true,
      historiaClinicaId: historiaClinicaIdValida,
      pacienteId: pacienteIdReal,
      estado: 'COMPLETADA',
    });

    await expect(
      useCase.ejecutar({
        odontogramaId: odontogramaTest.id.valor,
        versionEsperada: 1,
        tipoRevision: 'NUEVA_OBSERVACION',
        consultaId: consultaIdValida,
        fechaObservacionClinica: new Date(),
        motivoRevision: 'Revisión en consulta ya completada',
        deltas: [],
      })
    ).rejects.toThrow(ConsultaInvalidaError);
  });

  it('13. debe rechazar la revisión si versionEsperada no coincide con la versión vigente (409)', async () => {
    await expect(
      useCase.ejecutar({
        odontogramaId: odontogramaTest.id.valor,
        versionEsperada: 99,
        tipoRevision: 'NUEVA_OBSERVACION',
        fechaObservacionClinica: new Date(),
        motivoRevision: 'Revisión con versión obsoleta',
        deltas: [],
      })
    ).rejects.toThrow(ConflictoConcurrenteOdontogramaError);
  });

  it('14. debe registrar una enmienda correctiva válida referenciando la revisión corregida', async () => {
    const resultado = await useCase.ejecutar({
      odontogramaId: odontogramaTest.id.valor,
      versionEsperada: 1,
      tipoRevision: 'ENMIENDA_CORRECTIVA',
      revisionCorregidaId: revisionBasalTest.id.valor,
      aplicaAlEstadoActual: true,
      fechaObservacionClinica: new Date(),
      motivoRevision: 'Rectificación de estado por error de tipeo en registro previo',
      deltas: [
        {
          numeroFDI: 21,
          estadoAnatomicoNuevo: 'PRESENTE',
        },
      ],
    });

    expect(resultado.tipoRevision).toBe('ENMIENDA_CORRECTIVA');
    expect(resultado.revisionCorregidaId).toBe(revisionBasalTest.id.valor);
    expect(resultado.numeroRevision).toBe(2);
    expect(odontogramaTest.version).toBe(2);
    expect(odontogramaTest.obtenerPieza(21).estadoAnatomico).toBe('PRESENTE');
  });

  it('15. debe rechazar enmiendas sin revisionCorregidaId', async () => {
    await expect(
      useCase.ejecutar({
        odontogramaId: odontogramaTest.id.valor,
        versionEsperada: 1,
        tipoRevision: 'ENMIENDA_CORRECTIVA',
        aplicaAlEstadoActual: false,
        fechaObservacionClinica: new Date(),
        motivoRevision: 'Enmienda sin especificar revisión corregida',
        deltas: [],
      })
    ).rejects.toThrow(EnmiendaCorrectivaInvalidaError);
  });

  it('16. debe rechazar una enmienda que referencia una revisión de otro odontograma', async () => {
    const revisionOtroOdontograma = {
      ...revisionBasalTest,
      odontogramaId: OdontogramaId.generar(),
    };
    mockOdontogramaRepository.buscarRevisionPorId.mockResolvedValueOnce(revisionOtroOdontograma as any);

    await expect(
      useCase.ejecutar({
        odontogramaId: odontogramaTest.id.valor,
        versionEsperada: 1,
        tipoRevision: 'ENMIENDA_CORRECTIVA',
        revisionCorregidaId: revisionBasalTest.id.valor,
        aplicaAlEstadoActual: false,
        fechaObservacionClinica: new Date(),
        motivoRevision: 'Enmienda con revisión foránea',
        deltas: [],
      })
    ).rejects.toThrow(RevisionInvalidaError);
  });

  it('17. debe permitir enmienda sin efecto sobre estado actual (aplicaAlEstadoActual=false) dejando piezas actuales intactas', async () => {
    odontogramaTest.aplicarRevision({
      tipoRevision: 'NUEVA_OBSERVACION' as any,
      aplicaAlEstadoActual: true,
      odontologoId: OdontologoId.crear(odontologoIdMock),
      fechaObservacionClinica: new Date(),
      motivoRevision: 'Observación vigente que actualiza pieza 11',
      versionEsperada: 1,
      deltas: [{ numeroFDI: 11, estadoAnatomicoNuevo: 'PRESENTE' as any }],
    });
    expect(odontogramaTest.version).toBe(2);
    expect(odontogramaTest.obtenerPieza(11).estadoAnatomico).toBe('PRESENTE');

    const resultado = await useCase.ejecutar({
      odontogramaId: odontogramaTest.id.valor,
      versionEsperada: 2,
      tipoRevision: 'ENMIENDA_CORRECTIVA',
      revisionCorregidaId: revisionBasalTest.id.valor,
      aplicaAlEstadoActual: false,
      fechaObservacionClinica: new Date(),
      motivoRevision: 'Aclaración de antecedentes en revisión inicial sin mutar presente',
      deltas: [{ numeroFDI: 48, estadoAnatomicoNuevo: 'AUSENTE' as any }],
    });

    expect(resultado.aplicaAlEstadoActual).toBe(false);
    expect(resultado.numeroRevision).toBe(3);
    expect(odontogramaTest.version).toBe(3);

    expect(odontogramaTest.obtenerPieza(11).estadoAnatomico).toBe('PRESENTE');
    expect(odontogramaTest.obtenerPieza(48).estadoAnatomico).toBe('DESCONOCIDO');
  });

  it('21. debe rechazar que una NUEVA_OBSERVACION incluya una revisionCorregidaId', async () => {
    await expect(
      useCase.ejecutar({
        odontogramaId: odontogramaTest.id.valor,
        versionEsperada: 1,
        tipoRevision: 'NUEVA_OBSERVACION',
        revisionCorregidaId: RevisionId.generar().valor,
        fechaObservacionClinica: new Date(),
        motivoRevision: 'Observación que intenta indebidamente pasar revisionCorregidaId',
        deltas: [],
      })
    ).rejects.toThrow(RevisionInvalidaError);
  });

  it('22. debe propagar errores de infraestructura sin escrituras parciales simuladas si falla el repositorio', async () => {
    mockOdontogramaRepository.aplicarRevisionTransaccional.mockRejectedValueOnce(
      new Error('Fallo simulado de red en repositorio transaccional')
    );

    await expect(
      useCase.ejecutar({
        odontogramaId: odontogramaTest.id.valor,
        versionEsperada: 1,
        tipoRevision: 'NUEVA_OBSERVACION',
        fechaObservacionClinica: new Date(),
        motivoRevision: 'Observación que fallará en la base de datos',
        deltas: [],
      })
    ).rejects.toThrow('Fallo simulado de red en repositorio transaccional');
  });

  it('debe rechazar si el odontogramaId no existe', async () => {
    mockOdontogramaRepository.buscarPorId.mockResolvedValueOnce(null);

    await expect(
      useCase.ejecutar({
        odontogramaId: OdontogramaId.generar().valor,
        versionEsperada: 1,
        tipoRevision: 'NUEVA_OBSERVACION',
        fechaObservacionClinica: new Date(),
        motivoRevision: 'Revisión sobre odontograma inexistente',
        deltas: [],
      })
    ).rejects.toThrow(OdontogramaNoEncontradoError);
  });
});
