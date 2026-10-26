import { describe, it, expect, vi, beforeEach } from 'vitest';
import { InicializarOdontogramaUseCase } from './inicializar-odontograma.use-case.js';
import type { IOdontogramaRepositoryPort } from '../../domain/ports/odontograma.repository.port.js';
import type { IHistoriaClinicaContextPort } from '../ports/historia-clinica-context.port.js';
import type { IOdontologoContextPort } from '../ports/odontologo-context.port.js';
import { HistoriaClinicaInvalidaError } from '../errors/historia-clinica-invalida.error.js';
import { OdontogramaDuplicadoError } from '../../domain/errors/odontograma-duplicado.error.js';
import type { Odontograma } from '../../domain/entities/odontograma.entity.js';
import type { RevisionOdontograma } from '../../domain/entities/revision-odontograma.entity.js';

type MockOdontogramaRepository = {
  [K in keyof IOdontogramaRepositoryPort]: ReturnType<typeof vi.fn>;
};

type MockHistoriaClinicaContext = {
  [K in keyof IHistoriaClinicaContextPort]: ReturnType<typeof vi.fn>;
};

type MockOdontologoContext = {
  [K in keyof IOdontologoContextPort]: ReturnType<typeof vi.fn>;
};

describe('InicializarOdontogramaUseCase', () => {
  let useCase: InicializarOdontogramaUseCase;
  let mockOdontogramaRepository: MockOdontogramaRepository;
  let mockHistoriaClinicaContext: MockHistoriaClinicaContext;
  let mockOdontologoContext: MockOdontologoContext;

  const historiaClinicaIdValida = 'hc_12345678-1234-1234-1234-123456789abc';
  const pacienteIdReal = 'pac_87654321-4321-4321-4321-abcdef123456';
  const odontologoIdMock = 'od_henry_principal';

  beforeEach(() => {
    mockOdontogramaRepository = {
      guardarInicial: vi.fn().mockResolvedValue(undefined),
      aplicarRevisionTransaccional: vi.fn().mockResolvedValue(undefined),
      buscarPorId: vi.fn().mockResolvedValue(null),
      buscarPorHistoriaClinicaId: vi.fn().mockResolvedValue(null),
      buscarRevisionPorId: vi.fn().mockResolvedValue(null),
      listarRevisiones: vi.fn().mockResolvedValue({ revisiones: [], total: 0 }),
      listarRevisionesPorConsultaId: vi.fn().mockResolvedValue([]),
    };

    mockHistoriaClinicaContext = {
      obtenerResumenHistoria: vi.fn().mockResolvedValue({
        existe: true,
        pacienteId: pacienteIdReal,
        estado: 'ACTIVA',
      }),
    };

    mockOdontologoContext = {
      obtenerOdontologoActual: vi.fn().mockResolvedValue({
        odontologoId: odontologoIdMock,
      }),
    };

    useCase = new InicializarOdontogramaUseCase(
      mockOdontogramaRepository as unknown as IOdontogramaRepositoryPort,
      mockHistoriaClinicaContext as unknown as IHistoriaClinicaContextPort,
      mockOdontologoContext as unknown as IOdontologoContextPort
    );
  });

  it('1. debe inicializar exitosamente el odontograma basal con 52 posiciones FDI y revisión número 1', async () => {
    const resultado = await useCase.ejecutar({
      historiaClinicaId: historiaClinicaIdValida,
      tokenOdontologo: 'bearer-token-valido',
    });

    expect(resultado).toBeDefined();
    expect(resultado.historiaClinicaId).toBe(historiaClinicaIdValida);
    expect(resultado.pacienteId).toBe(pacienteIdReal);
    expect(resultado.version).toBe(1);
    expect(resultado.totalRevisiones).toBe(1);
    expect(resultado.piezas.length).toBe(52);

    for (const pieza of resultado.piezas) {
      expect(pieza.estadoAnatomico).toBe('DESCONOCIDO');
      expect(pieza.estadoEvaluacion).toBe('NO_EVALUADO');
      expect(pieza.tratamientosEstructurales.length).toBe(0);
      expect(Object.keys(pieza.superficies).length).toBe(5);
    }

    expect(mockOdontogramaRepository.guardarInicial).toHaveBeenCalledTimes(1);
    const [odontogramaGuardado, revisionGuardada] = mockOdontogramaRepository.guardarInicial.mock.calls[0] as [
      Odontograma,
      RevisionOdontograma,
    ];
    expect(odontogramaGuardado.id.valor).toBe(resultado.id);
    expect(revisionGuardada.numeroRevision).toBe(1);
    expect(revisionGuardada.tipoRevision).toBe('NUEVA_OBSERVACION');
    expect(revisionGuardada.snapshotPiezas.length).toBe(52);
  });

  it('2. debe rechazar la inicialización si la Historia Clínica no existe en el contexto', async () => {
    mockHistoriaClinicaContext.obtenerResumenHistoria.mockResolvedValueOnce(null);

    await expect(
      useCase.ejecutar({
        historiaClinicaId: historiaClinicaIdValida,
      })
    ).rejects.toThrow(HistoriaClinicaInvalidaError);

    expect(mockOdontogramaRepository.guardarInicial).not.toHaveBeenCalled();
  });

  it('3. debe rechazar la inicialización si la Historia Clínica no está en estado ACTIVA', async () => {
    mockHistoriaClinicaContext.obtenerResumenHistoria.mockResolvedValueOnce({
      existe: true,
      pacienteId: pacienteIdReal,
      estado: 'CERRADA',
    });

    await expect(
      useCase.ejecutar({
        historiaClinicaId: historiaClinicaIdValida,
      })
    ).rejects.toThrow(HistoriaClinicaInvalidaError);

    expect(mockOdontogramaRepository.guardarInicial).not.toHaveBeenCalled();
  });

  it('4. debe rechazar la inicialización si ya existe un odontograma para la historia clínica', async () => {
    mockOdontogramaRepository.buscarPorHistoriaClinicaId.mockResolvedValueOnce({} as Odontograma);

    await expect(
      useCase.ejecutar({
        historiaClinicaId: historiaClinicaIdValida,
      })
    ).rejects.toThrow(OdontogramaDuplicadoError);

    expect(mockOdontogramaRepository.guardarInicial).not.toHaveBeenCalled();
  });

  it('5. debe manejar errores de unicidad concurrente si el repositorio rechaza duplicidad en guardarInicial', async () => {
    mockOdontogramaRepository.guardarInicial.mockRejectedValueOnce(
      new OdontogramaDuplicadoError(historiaClinicaIdValida)
    );

    await expect(
      useCase.ejecutar({
        historiaClinicaId: historiaClinicaIdValida,
      })
    ).rejects.toThrow(OdontogramaDuplicadoError);
  });

  it('6. debe resolver el pacienteId real desde la historia y no admitir manipulación de profesional', async () => {
    await useCase.ejecutar({
      historiaClinicaId: historiaClinicaIdValida,
      tokenOdontologo: 'token-odontologo-autenticado',
    });

    expect(mockOdontologoContext.obtenerOdontologoActual).toHaveBeenCalledWith('token-odontologo-autenticado');
    const [odontogramaGuardado] = mockOdontogramaRepository.guardarInicial.mock.calls[0] as [Odontograma];
    expect(odontogramaGuardado.pacienteId.valor).toBe(pacienteIdReal);
    expect(odontogramaGuardado.actualizadoPor.valor).toBe(odontologoIdMock);
  });
});
