import { describe, it, expect, vi, beforeEach } from 'vitest';
import { CambiarEstadoHistoriaUseCase } from './cambiar-estado-historia.use-case.js';
import type { IHistoriaClinicaRepository } from '../../domain/ports/historia-clinica.repository.port.js';
import type { IOdontologoContextPort } from '../../domain/ports/odontologo-context.port.js';
import { HistoriaClinica } from '../../domain/entities/historia-clinica.entity.js';
import { PacienteId } from '../../domain/value-objects/paciente-id.vo.js';
import { OdontologoId } from '../../domain/value-objects/odontologo-id.vo.js';
import { EstadoHistoria } from '../../domain/value-objects/estado-historia.enum.js';
import { AccionAuditoria } from '../../domain/value-objects/accion-auditoria.enum.js';
import { HistoriaClinicaNoEncontradaError } from '../../domain/errors/historia-clinica-no-encontrada.error.js';
import { TransicionEstadoInvalidaError } from '../../domain/errors/transicion-estado-invalida.error.js';
import { ConflictoConcurrenteError } from '../../domain/errors/conflicto-concurrente.error.js';
import { AutenticacionRequeridaError } from '../errors/autenticacion-requerida.error.js';

type MockRepository = {
  [K in keyof IHistoriaClinicaRepository]: ReturnType<typeof vi.fn>;
};

type MockOdontologoContext = {
  [K in keyof IOdontologoContextPort]: ReturnType<typeof vi.fn>;
};

describe('CambiarEstadoHistoriaUseCase', () => {
  let useCase: CambiarEstadoHistoriaUseCase;
  let mockRepository: MockRepository;
  let mockOdontologoContext: MockOdontologoContext;

  beforeEach(() => {
    mockRepository = {
      guardar: vi.fn(),
      buscarPorId: vi.fn(),
      buscarPorPacienteId: vi.fn(),
      existePorPacienteId: vi.fn(),
      actualizar: vi.fn().mockImplementation((h: HistoriaClinica) => Promise.resolve(h)),
    };

    mockOdontologoContext = {
      obtenerOdontologoActual: vi.fn().mockResolvedValue({
        odontologoId: 'od_operador_estado',
      }),
    };

    useCase = new CambiarEstadoHistoriaUseCase(
      mockRepository as unknown as IHistoriaClinicaRepository,
      mockOdontologoContext as unknown as IOdontologoContextPort,
    );
  });

  it('debe cambiar de ACTIVA a CERRADA e incrementar versión con auditoría exitosamente', async () => {
    const historia = HistoriaClinica.crear(
      { pacienteId: PacienteId.crear('pac_001') },
      OdontologoId.crear('od_creador_001'),
    );
    mockRepository.buscarPorId.mockResolvedValue(historia);

    const result = await useCase.execute({
      tokenAutenticacion: 'token_valido',
      historiaClinicaId: historia.id.valor,
      versionEsperada: 1,
      nuevoEstado: EstadoHistoria.CERRADA,
      descripcion: 'Cierre de expediente por finalización de tratamiento integral',
    });

    expect(mockOdontologoContext.obtenerOdontologoActual).toHaveBeenCalledWith('token_valido');
    expect(mockRepository.actualizar).toHaveBeenCalledWith(historia, 1);
    expect(result.estado).toBe(EstadoHistoria.CERRADA);
    expect(result.version).toBe(2);

    const auditoria = result.historialCambios[result.historialCambios.length - 1];
    expect(auditoria.accion).toBe(AccionAuditoria.CAMBIO_ESTADO);
    expect(auditoria.odontologoId).toBe('od_operador_estado');
    expect(auditoria.camposModificados).toContain('estado');
  });

  it('debe permitir reabrir un expediente pasando de CERRADA a ACTIVA', async () => {
    const historia = HistoriaClinica.crear(
      { pacienteId: PacienteId.crear('pac_001') },
      OdontologoId.crear('od_001'),
    );
    historia.cambiarEstado(EstadoHistoria.CERRADA, OdontologoId.crear('od_001'));
    mockRepository.buscarPorId.mockResolvedValue(historia);

    const result = await useCase.execute({
      tokenAutenticacion: 'token_valido',
      historiaClinicaId: historia.id.valor,
      versionEsperada: historia.version,
      nuevoEstado: EstadoHistoria.ACTIVA,
      descripcion: 'Reapertura por nueva consulta clínica',
    });

    expect(result.estado).toBe(EstadoHistoria.ACTIVA);
    expect(result.version).toBe(3);
  });

  it('debe permitir archivar un expediente pasando a ARCHIVADA', async () => {
    const historia = HistoriaClinica.crear(
      { pacienteId: PacienteId.crear('pac_001') },
      OdontologoId.crear('od_001'),
    );
    mockRepository.buscarPorId.mockResolvedValue(historia);

    const result = await useCase.execute({
      tokenAutenticacion: 'token_valido',
      historiaClinicaId: historia.id.valor,
      versionEsperada: historia.version,
      nuevoEstado: EstadoHistoria.ARCHIVADA,
      descripcion: 'Expediente archivado por inactividad prolongada',
    });

    expect(result.estado).toBe(EstadoHistoria.ARCHIVADA);
  });

  it('debe lanzar AutenticacionRequeridaError si el token es ausente o vacío', async () => {
    await expect(
      useCase.execute({
        tokenAutenticacion: '',
        historiaClinicaId: 'hc_123',
        versionEsperada: 1,
        nuevoEstado: EstadoHistoria.CERRADA,
      }),
    ).rejects.toThrow(AutenticacionRequeridaError);
  });

  it('debe lanzar HistoriaClinicaNoEncontradaError si la historia clínica no existe', async () => {
    mockRepository.buscarPorId.mockResolvedValue(null);

    await expect(
      useCase.execute({
        tokenAutenticacion: 'token_valido',
        historiaClinicaId: 'hc_no_existe',
        versionEsperada: 1,
        nuevoEstado: EstadoHistoria.CERRADA,
      }),
    ).rejects.toThrow(HistoriaClinicaNoEncontradaError);
  });

  it('debe lanzar TransicionEstadoInvalidaError si la máquina de estados rechaza la transición (ej. ARCHIVADA a ACTIVA)', async () => {
    const historia = HistoriaClinica.crear(
      { pacienteId: PacienteId.crear('pac_001') },
      OdontologoId.crear('od_001'),
    );
    historia.cambiarEstado(EstadoHistoria.ARCHIVADA, OdontologoId.crear('od_001'));
    mockRepository.buscarPorId.mockResolvedValue(historia);

    await expect(
      useCase.execute({
        tokenAutenticacion: 'token_valido',
        historiaClinicaId: historia.id.valor,
        versionEsperada: historia.version,
        nuevoEstado: EstadoHistoria.ACTIVA, // ARCHIVADA es irreversible
      }),
    ).rejects.toThrow(TransicionEstadoInvalidaError);
  });

  it('debe lanzar ConflictoConcurrenteError si el repositorio detecta versión desactualizada', async () => {
    const historia = HistoriaClinica.crear(
      { pacienteId: PacienteId.crear('pac_001') },
      OdontologoId.crear('od_001'),
    );
    mockRepository.buscarPorId.mockResolvedValue(historia);
    mockRepository.actualizar.mockRejectedValue(new ConflictoConcurrenteError(4));

    await expect(
      useCase.execute({
        tokenAutenticacion: 'token_valido',
        historiaClinicaId: historia.id.valor,
        versionEsperada: 1,
        nuevoEstado: EstadoHistoria.CERRADA,
      }),
    ).rejects.toThrow(ConflictoConcurrenteError);
  });
});
