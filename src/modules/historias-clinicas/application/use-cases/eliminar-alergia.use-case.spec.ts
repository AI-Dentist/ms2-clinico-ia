import { describe, it, expect, vi, beforeEach } from 'vitest';
import { EliminarAlergiaUseCase } from './eliminar-alergia.use-case.js';
import type { IHistoriaClinicaRepository } from '../../domain/ports/historia-clinica.repository.port.js';
import type { IOdontologoContextPort } from '../../domain/ports/odontologo-context.port.js';
import { HistoriaClinica } from '../../domain/entities/historia-clinica.entity.js';
import { PacienteId } from '../../domain/value-objects/paciente-id.vo.js';
import { OdontologoId } from '../../domain/value-objects/odontologo-id.vo.js';
import { EstadoHistoria } from '../../domain/value-objects/estado-historia.enum.js';
import { AccionAuditoria } from '../../domain/value-objects/accion-auditoria.enum.js';
import { SeveridadAlergia } from '../../domain/value-objects/severidad-alergia.enum.js';
import { Alergia } from '../../domain/value-objects/alergia.vo.js';
import { HistoriaClinicaNoEncontradaError } from '../../domain/errors/historia-clinica-no-encontrada.error.js';
import { ConflictoConcurrenteError } from '../../domain/errors/conflicto-concurrente.error.js';
import { HistoriaClinicaNoEditableError } from '../../domain/errors/historia-clinica-no-editable.error.js';
import { AutenticacionRequeridaError } from '../errors/autenticacion-requerida.error.js';

type MockRepository = {
  [K in keyof IHistoriaClinicaRepository]: ReturnType<typeof vi.fn>;
};

type MockOdontologoContext = {
  [K in keyof IOdontologoContextPort]: ReturnType<typeof vi.fn>;
};

describe('EliminarAlergiaUseCase', () => {
  let useCase: EliminarAlergiaUseCase;
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
        odontologoId: 'od_operador_eliminar',
      }),
    };

    useCase = new EliminarAlergiaUseCase(
      mockRepository as unknown as IHistoriaClinicaRepository,
      mockOdontologoContext as unknown as IOdontologoContextPort,
    );
  });

  it('debe eliminar la alergia e incrementar la versión con auditoría exitosamente', async () => {
    const historia = HistoriaClinica.crear(
      { pacienteId: PacienteId.crear('pac_001') },
      OdontologoId.crear('od_001'),
    );
    historia.agregarAlergia(
      Alergia.crear({
        sustancia: 'Penicilina',
        tipoReaccion: 'Urticaria',
        severidad: SeveridadAlergia.GRAVE,
        notasAdicionales: null,
      }),
      OdontologoId.crear('od_001'),
    );
    mockRepository.buscarPorId.mockResolvedValue(historia);

    const result = await useCase.execute({
      tokenAutenticacion: 'token_valido',
      historiaClinicaId: historia.id.valor,
      versionEsperada: historia.version,
      sustancia: 'penicilina', // case-insensitive
      descripcion: 'Prueba de alergia dio negativa en reevaluación médica',
    });

    expect(mockRepository.actualizar).toHaveBeenCalledWith(historia, 2);
    expect(result.alergias).toHaveLength(0);
    expect(result.version).toBe(3);

    const auditoria = result.historialCambios[result.historialCambios.length - 1];
    expect(auditoria.accion).toBe(AccionAuditoria.ELIMINACION_ALERGIA);
    expect(auditoria.odontologoId).toBe('od_operador_eliminar');
  });

  it('debe lanzar AutenticacionRequeridaError si el token es ausente o vacío', async () => {
    await expect(
      useCase.execute({
        tokenAutenticacion: '',
        historiaClinicaId: 'hc_123',
        versionEsperada: 1,
        sustancia: 'Penicilina',
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
        sustancia: 'Penicilina',
      }),
    ).rejects.toThrow(HistoriaClinicaNoEncontradaError);
  });

  it('debe lanzar Error si la sustancia no está registrada en el expediente', async () => {
    const historia = HistoriaClinica.crear(
      { pacienteId: PacienteId.crear('pac_001') },
      OdontologoId.crear('od_001'),
    );
    mockRepository.buscarPorId.mockResolvedValue(historia);

    await expect(
      useCase.execute({
        tokenAutenticacion: 'token_valido',
        historiaClinicaId: historia.id.valor,
        versionEsperada: historia.version,
        sustancia: 'Amoxicilina',
      }),
    ).rejects.toThrow("No existe alergia registrada para la sustancia 'Amoxicilina'.");
  });

  it('debe lanzar HistoriaClinicaNoEditableError si el expediente no está ACTIVO', async () => {
    const historia = HistoriaClinica.crear(
      { pacienteId: PacienteId.crear('pac_001') },
      OdontologoId.crear('od_001'),
    );
    historia.agregarAlergia(
      Alergia.crear({
        sustancia: 'Penicilina',
        tipoReaccion: 'Urticaria',
        severidad: SeveridadAlergia.LEVE,
        notasAdicionales: null,
      }),
      OdontologoId.crear('od_001'),
    );
    historia.cambiarEstado(EstadoHistoria.CERRADA, OdontologoId.crear('od_001'));
    mockRepository.buscarPorId.mockResolvedValue(historia);

    await expect(
      useCase.execute({
        tokenAutenticacion: 'token_valido',
        historiaClinicaId: historia.id.valor,
        versionEsperada: historia.version,
        sustancia: 'Penicilina',
      }),
    ).rejects.toThrow(HistoriaClinicaNoEditableError);
  });

  it('debe lanzar ConflictoConcurrenteError si el repositorio detecta versión desactualizada', async () => {
    const historia = HistoriaClinica.crear(
      { pacienteId: PacienteId.crear('pac_001') },
      OdontologoId.crear('od_001'),
    );
    historia.agregarAlergia(
      Alergia.crear({
        sustancia: 'Penicilina',
        tipoReaccion: 'Urticaria',
        severidad: SeveridadAlergia.LEVE,
        notasAdicionales: null,
      }),
      OdontologoId.crear('od_001'),
    );
    mockRepository.buscarPorId.mockResolvedValue(historia);
    mockRepository.actualizar.mockRejectedValue(new ConflictoConcurrenteError(5));

    await expect(
      useCase.execute({
        tokenAutenticacion: 'token_valido',
        historiaClinicaId: historia.id.valor,
        versionEsperada: 1, // versión obsoleta
        sustancia: 'Penicilina',
      }),
    ).rejects.toThrow(ConflictoConcurrenteError);
  });
});
