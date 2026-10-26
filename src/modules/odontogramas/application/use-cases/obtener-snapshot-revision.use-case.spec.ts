import { describe, it, expect, vi, beforeEach } from 'vitest';
import { ObtenerSnapshotRevisionUseCase } from './obtener-snapshot-revision.use-case.js';
import type { IOdontogramaRepositoryPort } from '../../domain/ports/odontograma.repository.port.js';
import { Odontograma } from '../../domain/entities/odontograma.entity.js';
import { HistoriaClinicaId } from '../../../historias-clinicas/domain/value-objects/historia-clinica-id.vo.js';
import { PacienteId } from '../../../historias-clinicas/domain/value-objects/paciente-id.vo.js';
import { OdontologoId } from '../../../historias-clinicas/domain/value-objects/odontologo-id.vo.js';
import { OdontogramaId } from '../../domain/value-objects/odontograma-id.vo.js';
import { RevisionId } from '../../domain/value-objects/revision-id.vo.js';
import { OdontogramaNoEncontradoError } from '../../domain/errors/odontograma-no-encontrado.error.js';
import { RevisionInvalidaError } from '../errors/revision-invalida.error.js';

type MockOdontogramaRepository = {
  [K in keyof IOdontogramaRepositoryPort]: ReturnType<typeof vi.fn>;
};

describe('ObtenerSnapshotRevisionUseCase', () => {
  let useCase: ObtenerSnapshotRevisionUseCase;
  let mockOdontogramaRepository: MockOdontogramaRepository;

  let odontogramaTest: Odontograma;
  let revisionBasalTest: any;

  beforeEach(() => {
    const { odontograma, revisionBasal } = Odontograma.inicializar({
      historiaClinicaId: HistoriaClinicaId.reconstituir('hc_12345678-1234-1234-1234-123456789abc'),
      pacienteId: PacienteId.crear('pac_87654321-4321-4321-4321-abcdef123456'),
      odontologoId: OdontologoId.crear('od_henry_principal'),
    });
    odontogramaTest = odontograma;
    revisionBasalTest = revisionBasal;

    mockOdontogramaRepository = {
      guardarInicial: vi.fn(),
      aplicarRevisionTransaccional: vi.fn(),
      buscarPorId: vi.fn().mockResolvedValue(odontogramaTest),
      buscarPorHistoriaClinicaId: vi.fn(),
      buscarRevisionPorId: vi.fn().mockResolvedValue(revisionBasalTest),
      listarRevisiones: vi.fn(),
      listarRevisionesPorConsultaId: vi.fn(),
    };

    useCase = new ObtenerSnapshotRevisionUseCase(
      mockOdontogramaRepository as unknown as IOdontogramaRepositoryPort
    );
  });

  it('19. debe obtener el snapshot histórico inmutable de una revisión específica', async () => {
    const resultado = await useCase.ejecutar({
      odontogramaId: odontogramaTest.id.valor,
      revisionId: revisionBasalTest.id.valor,
    });

    expect(resultado).toBeDefined();
    expect(resultado.id).toBe(revisionBasalTest.id.valor);
    expect(resultado.numeroRevision).toBe(1);
    expect(resultado.snapshotPiezas.length).toBe(52);
  });

  it('debe rechazar si la revisión histórica no existe', async () => {
    mockOdontogramaRepository.buscarRevisionPorId.mockResolvedValueOnce(null);

    await expect(
      useCase.ejecutar({
        odontogramaId: odontogramaTest.id.valor,
        revisionId: RevisionId.generar().valor,
      })
    ).rejects.toThrow(RevisionInvalidaError);
  });

  it('debe rechazar si la revisión pertenece a otro odontograma', async () => {
    const revisionAjena = {
      ...revisionBasalTest,
      odontogramaId: OdontogramaId.generar(),
    };
    mockOdontogramaRepository.buscarRevisionPorId.mockResolvedValueOnce(revisionAjena as any);

    await expect(
      useCase.ejecutar({
        odontogramaId: odontogramaTest.id.valor,
        revisionId: revisionBasalTest.id.valor,
      })
    ).rejects.toThrow(RevisionInvalidaError);
  });

  it('debe rechazar si el odontograma no existe', async () => {
    mockOdontogramaRepository.buscarPorId.mockResolvedValueOnce(null);

    await expect(
      useCase.ejecutar({
        odontogramaId: OdontogramaId.generar().valor,
        revisionId: revisionBasalTest.id.valor,
      })
    ).rejects.toThrow(OdontogramaNoEncontradoError);
  });
});
