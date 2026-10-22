import { describe, it, expect, vi, beforeEach } from 'vitest';
import { ActualizarAntecedentesUseCase } from './actualizar-antecedentes.use-case.js';
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

describe('ActualizarAntecedentesUseCase', () => {
  let useCase: ActualizarAntecedentesUseCase;
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
        odontologoId: 'od_editor_005',
      }),
    };

    useCase = new ActualizarAntecedentesUseCase(
      mockRepository as unknown as IHistoriaClinicaRepository,
      mockOdontologoContext as unknown as IOdontologoContextPort,
    );
  });

  it('debe actualizar los antecedentes e incrementar la versión con auditoría exitosamente', async () => {
    const historia = HistoriaClinica.crear(
      { pacienteId: PacienteId.crear('pac_001') },
      OdontologoId.crear('od_creador_001'),
    );
    expect(historia.version).toBe(1);

    mockRepository.buscarPorId.mockResolvedValue(historia);

    const result = await useCase.execute({
      tokenAutenticacion: 'token_valido_editor',
      historiaClinicaId: historia.id.valor,
      versionEsperada: 1,
      nuevosAntecedentes: {
        enfermedadesCronicas: [
          {
            nombre: 'Hipertensión',
            estado: 'CONFIRMADO',
            detalle: 'Enalapril 10mg/día',
          },
        ],
      },
      camposModificados: ['antecedentes.enfermedadesCronicas'],
      descripcion: 'Actualización en primera consulta de control.',
    });

    expect(mockOdontologoContext.obtenerOdontologoActual).toHaveBeenCalledWith(
      'token_valido_editor',
    );
    expect(mockRepository.actualizar).toHaveBeenCalledWith(historia, 1);
    expect(result.version).toBe(2);
    expect(result.antecedentes.enfermedadesCronicas).toHaveLength(1);
    expect(result.antecedentes.enfermedadesCronicas[0].detalle).toBe('Enalapril 10mg/día');

    // Comprobar que la nueva entrada de auditoría contiene los datos del operador autenticado
    const ultimaAuditoria = result.historialCambios[result.historialCambios.length - 1];
    expect(ultimaAuditoria.accion).toBe(AccionAuditoria.ACTUALIZACION_ANTECEDENTES);
    expect(ultimaAuditoria.odontologoId).toBe('od_editor_005');
    expect(ultimaAuditoria.camposModificados).toContain('antecedentes.enfermedadesCronicas');
  });

  it('debe lanzar AutenticacionRequeridaError si el token es ausente o vacío', async () => {
    await expect(
      useCase.execute({
        tokenAutenticacion: '',
        historiaClinicaId: 'hc_123',
        versionEsperada: 1,
        nuevosAntecedentes: {},
        camposModificados: [],
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
        nuevosAntecedentes: {},
        camposModificados: [],
      }),
    ).rejects.toThrow(HistoriaClinicaNoEncontradaError);

    expect(mockRepository.actualizar).not.toHaveBeenCalled();
  });

  it('debe lanzar ConflictoConcurrenteError si el repositorio detecta versión esperada obsoleta', async () => {
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
        versionEsperada: 1, // el cliente esperaba versión 1 pero en BD está en 3
        nuevosAntecedentes: {},
        camposModificados: [],
      }),
    ).rejects.toThrow(ConflictoConcurrenteError);
  });

  it('debe lanzar HistoriaClinicaNoEditableError si el expediente no está en estado ACTIVA', async () => {
    const historia = HistoriaClinica.crear(
      { pacienteId: PacienteId.crear('pac_001') },
      OdontologoId.crear('od_001'),
    );
    // Cambiar a CERRADA
    historia.cambiarEstado(EstadoHistoria.CERRADA, OdontologoId.crear('od_001'));

    mockRepository.buscarPorId.mockResolvedValue(historia);

    await expect(
      useCase.execute({
        tokenAutenticacion: 'token_valido',
        historiaClinicaId: historia.id.valor,
        versionEsperada: historia.version,
        nuevosAntecedentes: {},
        camposModificados: [],
      }),
    ).rejects.toThrow(HistoriaClinicaNoEditableError);

    expect(mockRepository.actualizar).not.toHaveBeenCalled();
  });
});
