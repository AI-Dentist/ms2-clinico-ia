import { describe, it, expect, vi, beforeEach } from 'vitest';
import { ObtenerSnapshotsPorConsultaUseCase } from './obtener-snapshots-por-consulta.use-case.js';
import type { IOdontogramaRepositoryPort } from '../../domain/ports/odontograma.repository.port.js';
import type { IConsultaOdontologicaContextPort } from '../ports/consulta-odontologica-context.port.js';
import { Odontograma } from '../../domain/entities/odontograma.entity.js';
import { HistoriaClinicaId } from '../../../historias-clinicas/domain/value-objects/historia-clinica-id.vo.js';
import { PacienteId } from '../../../historias-clinicas/domain/value-objects/paciente-id.vo.js';
import { OdontologoId } from '../../../historias-clinicas/domain/value-objects/odontologo-id.vo.js';
import { ConsultaId } from '../../../consultas-odontologicas/domain/value-objects/consulta-id.vo.js';
import { ConsultaInvalidaError } from '../errors/consulta-invalida.error.js';

type MockOdontogramaRepository = {
  [K in keyof IOdontogramaRepositoryPort]: ReturnType<typeof vi.fn>;
};

type MockConsultaContext = {
  [K in keyof IConsultaOdontologicaContextPort]: ReturnType<typeof vi.fn>;
};

describe('ObtenerSnapshotsPorConsultaUseCase', () => {
  let useCase: ObtenerSnapshotsPorConsultaUseCase;
  let mockOdontogramaRepository: MockOdontogramaRepository;
  let mockConsultaContext: MockConsultaContext;

  const consultaIdValida = ConsultaId.generar().valor;
  let revision1Test: any;
  let revision2Test: any;

  beforeEach(() => {
    const { odontograma } = Odontograma.inicializar({
      historiaClinicaId: HistoriaClinicaId.reconstituir('hc_12345678-1234-1234-1234-123456789abc'),
      pacienteId: PacienteId.crear('pac_87654321-4321-4321-4321-abcdef123456'),
      odontologoId: OdontologoId.crear('od_henry_principal'),
    });

    revision1Test = odontograma.aplicarRevision({
      tipoRevision: 'NUEVA_OBSERVACION' as any,
      aplicaAlEstadoActual: true,
      consultaId: ConsultaId.reconstituir(consultaIdValida),
      odontologoId: OdontologoId.crear('od_henry_principal'),
      fechaObservacionClinica: new Date('2026-10-25T10:00:00.000Z'),
      motivoRevision: 'Primera revisión de la consulta',
      versionEsperada: 1,
      deltas: [],
    });

    revision2Test = odontograma.aplicarRevision({
      tipoRevision: 'NUEVA_OBSERVACION' as any,
      aplicaAlEstadoActual: true,
      consultaId: ConsultaId.reconstituir(consultaIdValida),
      odontologoId: OdontologoId.crear('od_henry_principal'),
      fechaObservacionClinica: new Date('2026-10-25T10:30:00.000Z'),
      motivoRevision: 'Segunda revisión dentro de la misma consulta',
      versionEsperada: 2,
      deltas: [],
    });

    mockOdontogramaRepository = {
      guardarInicial: vi.fn(),
      aplicarRevisionTransaccional: vi.fn(),
      buscarPorId: vi.fn(),
      buscarPorHistoriaClinicaId: vi.fn(),
      buscarRevisionPorId: vi.fn(),
      listarRevisiones: vi.fn(),
      listarRevisionesPorConsultaId: vi.fn().mockResolvedValue([revision1Test, revision2Test]),
    };

    mockConsultaContext = {
      obtenerResumenConsulta: vi.fn().mockResolvedValue({
        existe: true,
        historiaClinicaId: 'hc_12345678-1234-1234-1234-123456789abc',
        pacienteId: 'pac_87654321-4321-4321-4321-abcdef123456',
        estado: 'EN_CURSO',
      }),
    };

    useCase = new ObtenerSnapshotsPorConsultaUseCase(
      mockOdontogramaRepository as unknown as IOdontogramaRepositoryPort,
      mockConsultaContext as unknown as IConsultaOdontologicaContextPort
    );
  });

  it('20. debe retornar múltiples revisiones asociadas a una misma consulta clínica en orden cronológico', async () => {
    const resultado = await useCase.ejecutar({
      consultaId: consultaIdValida,
    });

    expect(resultado).toBeDefined();
    expect(resultado.length).toBe(2);
    expect(resultado[0].numeroRevision).toBe(2);
    expect(resultado[1].numeroRevision).toBe(3);
    expect(resultado[0].consultaId).toBe(consultaIdValida);
    expect(resultado[1].consultaId).toBe(consultaIdValida);

    expect(mockOdontogramaRepository.listarRevisionesPorConsultaId).toHaveBeenCalledTimes(1);
  });

  it('debe rechazar la consulta si la Consulta Odontológica no existe en el sistema', async () => {
    mockConsultaContext.obtenerResumenConsulta.mockResolvedValueOnce(null);

    await expect(
      useCase.ejecutar({
        consultaId: consultaIdValida,
      })
    ).rejects.toThrow(ConsultaInvalidaError);
  });
});
