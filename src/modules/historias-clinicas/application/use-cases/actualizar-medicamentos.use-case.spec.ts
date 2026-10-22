import { describe, it, expect, vi, beforeEach } from 'vitest';
import { ActualizarMedicamentosUseCase } from './actualizar-medicamentos.use-case.js';
import type { IHistoriaClinicaRepository } from '../../domain/ports/historia-clinica.repository.port.js';
import type { IOdontologoContextPort } from '../../domain/ports/odontologo-context.port.js';
import { HistoriaClinica } from '../../domain/entities/historia-clinica.entity.js';
import { PacienteId } from '../../domain/value-objects/paciente-id.vo.js';
import { OdontologoId } from '../../domain/value-objects/odontologo-id.vo.js';
import { EstadoHistoria } from '../../domain/value-objects/estado-historia.enum.js';
import { AccionAuditoria } from '../../domain/value-objects/accion-auditoria.enum.js';
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

describe('ActualizarMedicamentosUseCase', () => {
  let useCase: ActualizarMedicamentosUseCase;
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
        odontologoId: 'od_operador_meds',
      }),
    };

    useCase = new ActualizarMedicamentosUseCase(
      mockRepository as unknown as IHistoriaClinicaRepository,
      mockOdontologoContext as unknown as IOdontologoContextPort,
    );
  });

  it('debe reemplazar medicamentos actuales e incrementar versión con auditoría exitosamente', async () => {
    const historia = HistoriaClinica.crear(
      { pacienteId: PacienteId.crear('pac_001') },
      OdontologoId.crear('od_creador_001'),
    );
    mockRepository.buscarPorId.mockResolvedValue(historia);

    const result = await useCase.execute({
      tokenAutenticacion: 'token_valido',
      historiaClinicaId: historia.id.valor,
      versionEsperada: 1,
      medicamentos: [
        {
          nombre: 'Losartán 50mg',
          principioActivo: 'Losartán potásico',
          dosis: '1 comprimido cada 12 horas',
          motivoUso: 'Hipertensión arterial',
          prescritoDesde: '2025-01-10T00:00:00.000Z',
        },
      ],
      descripcion: 'Actualización farmacológica en anamnesis',
    });

    expect(mockOdontologoContext.obtenerOdontologoActual).toHaveBeenCalledWith('token_valido');
    expect(mockRepository.actualizar).toHaveBeenCalledWith(historia, 1);
    expect(result.version).toBe(2);
    expect(result.medicamentosActuales).toHaveLength(1);
    expect(result.medicamentosActuales[0].nombre).toBe('Losartán 50mg');
    expect(result.medicamentosActuales[0].principioActivo).toBe('Losartán potásico');

    const auditoria = result.historialCambios[result.historialCambios.length - 1];
    expect(auditoria.accion).toBe(AccionAuditoria.ACTUALIZACION_MEDICAMENTOS);
    expect(auditoria.odontologoId).toBe('od_operador_meds');
  });

  it('debe lanzar AutenticacionRequeridaError si el token es ausente o vacío', async () => {
    await expect(
      useCase.execute({
        tokenAutenticacion: '   ',
        historiaClinicaId: 'hc_123',
        versionEsperada: 1,
        medicamentos: [],
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
        medicamentos: [],
      }),
    ).rejects.toThrow(HistoriaClinicaNoEncontradaError);
  });

  it('debe lanzar HistoriaClinicaNoEditableError si el expediente no está ACTIVO', async () => {
    const historia = HistoriaClinica.crear(
      { pacienteId: PacienteId.crear('pac_001') },
      OdontologoId.crear('od_001'),
    );
    historia.cambiarEstado(EstadoHistoria.CERRADA, OdontologoId.crear('od_001'));
    mockRepository.buscarPorId.mockResolvedValue(historia);

    await expect(
      useCase.execute({
        tokenAutenticacion: 'token_valido',
        historiaClinicaId: historia.id.valor,
        versionEsperada: historia.version,
        medicamentos: [],
      }),
    ).rejects.toThrow(HistoriaClinicaNoEditableError);
  });

  it('debe lanzar ConflictoConcurrenteError si el repositorio detecta versión desactualizada', async () => {
    const historia = HistoriaClinica.crear(
      { pacienteId: PacienteId.crear('pac_001') },
      OdontologoId.crear('od_001'),
    );
    mockRepository.buscarPorId.mockResolvedValue(historia);
    mockRepository.actualizar.mockRejectedValue(new ConflictoConcurrenteError(3));

    await expect(
      useCase.execute({
        tokenAutenticacion: 'token_valido',
        historiaClinicaId: historia.id.valor,
        versionEsperada: 1,
        medicamentos: [],
      }),
    ).rejects.toThrow(ConflictoConcurrenteError);
  });
});
