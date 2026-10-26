import { describe, it, expect, vi, beforeEach } from 'vitest';
import { ListarHistorialRevisionesUseCase } from './listar-historial-revisiones.use-case.js';
import type { IOdontogramaRepositoryPort } from '../../domain/ports/odontograma.repository.port.js';
import { Odontograma } from '../../domain/entities/odontograma.entity.js';
import { HistoriaClinicaId } from '../../../historias-clinicas/domain/value-objects/historia-clinica-id.vo.js';
import { PacienteId } from '../../../historias-clinicas/domain/value-objects/paciente-id.vo.js';
import { OdontologoId } from '../../../historias-clinicas/domain/value-objects/odontologo-id.vo.js';
import { OdontogramaId } from '../../domain/value-objects/odontograma-id.vo.js';
import { OdontogramaNoEncontradoError } from '../../domain/errors/odontograma-no-encontrado.error.js';

type MockOdontogramaRepository = {
  [K in keyof IOdontogramaRepositoryPort]: ReturnType<typeof vi.fn>;
};

describe('ListarHistorialRevisionesUseCase', () => {
  let useCase: ListarHistorialRevisionesUseCase;
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
      buscarRevisionPorId: vi.fn(),
      listarRevisiones: vi.fn().mockResolvedValue({
        revisiones: [revisionBasalTest],
        total: 1,
      }),
      listarRevisionesPorConsultaId: vi.fn(),
    };

    useCase = new ListarHistorialRevisionesUseCase(
      mockOdontogramaRepository as unknown as IOdontogramaRepositoryPort
    );
  });

  it('18. debe listar el historial cronológico paginado de revisiones', async () => {
    const resultado = await useCase.ejecutar({
      odontogramaId: odontogramaTest.id.valor,
      limite: 10,
      offset: 0,
    });

    expect(resultado).toBeDefined();
    expect(resultado.total).toBe(1);
    expect(resultado.limite).toBe(10);
    expect(resultado.offset).toBe(0);
    expect(resultado.revisiones.length).toBe(1);
    expect(resultado.revisiones[0].numeroRevision).toBe(1);

    expect(mockOdontogramaRepository.listarRevisiones).toHaveBeenCalledWith(
      expect.anything(),
      10,
      0
    );
  });

  it('debe acotar límites excesivos o negativos a rangos seguros', async () => {
    await useCase.ejecutar({
      odontogramaId: odontogramaTest.id.valor,
      limite: 500,
      offset: -5,
    });

    expect(mockOdontogramaRepository.listarRevisiones).toHaveBeenCalledWith(
      expect.anything(),
      100,
      0
    );
  });

  it('debe rechazar la consulta si el odontograma no existe', async () => {
    mockOdontogramaRepository.buscarPorId.mockResolvedValueOnce(null);

    await expect(
      useCase.ejecutar({
        odontogramaId: OdontogramaId.generar().valor,
      })
    ).rejects.toThrow(OdontogramaNoEncontradoError);
  });
});
