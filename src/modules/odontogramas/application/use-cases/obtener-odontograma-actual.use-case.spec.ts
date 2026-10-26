import { describe, it, expect, vi, beforeEach } from 'vitest';
import { ObtenerOdontogramaActualUseCase } from './obtener-odontograma-actual.use-case.js';
import type { IOdontogramaRepositoryPort } from '../../domain/ports/odontograma.repository.port.js';
import type { IHistoriaClinicaContextPort } from '../ports/historia-clinica-context.port.js';
import { Odontograma } from '../../domain/entities/odontograma.entity.js';
import { HistoriaClinicaId } from '../../../historias-clinicas/domain/value-objects/historia-clinica-id.vo.js';
import { PacienteId } from '../../../historias-clinicas/domain/value-objects/paciente-id.vo.js';
import { OdontologoId } from '../../../historias-clinicas/domain/value-objects/odontologo-id.vo.js';
import { OdontogramaNoEncontradoError } from '../../domain/errors/odontograma-no-encontrado.error.js';
import { HistoriaClinicaInvalidaError } from '../errors/historia-clinica-invalida.error.js';

type MockOdontogramaRepository = {
  [K in keyof IOdontogramaRepositoryPort]: ReturnType<typeof vi.fn>;
};

type MockHistoriaClinicaContext = {
  [K in keyof IHistoriaClinicaContextPort]: ReturnType<typeof vi.fn>;
};

describe('ObtenerOdontogramaActualUseCase', () => {
  let useCase: ObtenerOdontogramaActualUseCase;
  let mockOdontogramaRepository: MockOdontogramaRepository;
  let mockHistoriaClinicaContext: MockHistoriaClinicaContext;

  const historiaClinicaIdValida = 'hc_12345678-1234-1234-1234-123456789abc';
  const pacienteIdReal = 'pac_87654321-4321-4321-4321-abcdef123456';
  const odontologoIdMock = 'od_henry_principal';

  beforeEach(() => {
    mockOdontogramaRepository = {
      guardarInicial: vi.fn(),
      aplicarRevisionTransaccional: vi.fn(),
      buscarPorId: vi.fn(),
      buscarPorHistoriaClinicaId: vi.fn(),
      buscarRevisionPorId: vi.fn(),
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

    useCase = new ObtenerOdontogramaActualUseCase(
      mockOdontogramaRepository as unknown as IOdontogramaRepositoryPort,
      mockHistoriaClinicaContext as unknown as IHistoriaClinicaContextPort
    );
  });

  it('7. debe obtener el estado actual del odontograma manteniendo explícitos DESCONOCIDO y NO_EVALUADO', async () => {
    const { odontograma } = Odontograma.inicializar({
      historiaClinicaId: HistoriaClinicaId.reconstituir(historiaClinicaIdValida),
      pacienteId: PacienteId.crear(pacienteIdReal),
      odontologoId: OdontologoId.crear(odontologoIdMock),
    });

    mockOdontogramaRepository.buscarPorHistoriaClinicaId.mockResolvedValueOnce(odontograma);

    const resultado = await useCase.ejecutar({
      historiaClinicaId: historiaClinicaIdValida,
    });

    expect(resultado).toBeDefined();
    expect(resultado.id).toBe(odontograma.id.valor);
    expect(resultado.piezas.length).toBe(52);
    expect(resultado.piezas[0].estadoAnatomico).toBe('DESCONOCIDO');
    expect(resultado.piezas[0].estadoEvaluacion).toBe('NO_EVALUADO');
  });

  it('debe rechazar la consulta si la Historia Clínica no existe en el sistema', async () => {
    mockHistoriaClinicaContext.obtenerResumenHistoria.mockResolvedValueOnce(null);

    await expect(
      useCase.ejecutar({
        historiaClinicaId: historiaClinicaIdValida,
      })
    ).rejects.toThrow(HistoriaClinicaInvalidaError);
  });

  it('debe lanzar OdontogramaNoEncontradoError si la historia clínica existe pero no tiene odontograma inicializado', async () => {
    mockOdontogramaRepository.buscarPorHistoriaClinicaId.mockResolvedValueOnce(null);

    await expect(
      useCase.ejecutar({
        historiaClinicaId: historiaClinicaIdValida,
      })
    ).rejects.toThrow(OdontogramaNoEncontradoError);
  });
});
