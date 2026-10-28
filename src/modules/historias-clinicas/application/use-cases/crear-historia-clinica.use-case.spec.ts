import { describe, it, expect, vi, beforeEach } from 'vitest';
import { CrearHistoriaClinicaUseCase } from './crear-historia-clinica.use-case.js';
import type { IHistoriaClinicaRepository } from '../../domain/ports/historia-clinica.repository.port.js';
import type { IPacienteValidatorPort } from '../../domain/ports/paciente-validator.port.js';
import type { IOdontologoContextPort } from '../../domain/ports/odontologo-context.port.js';
import { HistoriaClinicaDuplicadaError } from '../../domain/errors/historia-clinica-duplicada.error.js';
import { PacienteInexistenteError } from '../errors/paciente-inexistente.error.js';
import { AutenticacionRequeridaError } from '../errors/autenticacion-requerida.error.js';
import { PacienteNoDisponibleError } from '../../infrastructure/adapters/errors/paciente-no-disponible.error.js';
import { AutenticacionMs1Error } from '../../infrastructure/adapters/errors/autenticacion-ms1.error.js';
import { EstadoHistoria } from '../../domain/value-objects/estado-historia.enum.js';
import { AccionAuditoria } from '../../domain/value-objects/accion-auditoria.enum.js';

type MockRepository = {
  [K in keyof IHistoriaClinicaRepository]: ReturnType<typeof vi.fn>;
};

type MockPacienteValidator = {
  [K in keyof IPacienteValidatorPort]: ReturnType<typeof vi.fn>;
};

type MockOdontologoContext = {
  [K in keyof IOdontologoContextPort]: ReturnType<typeof vi.fn>;
};

describe('CrearHistoriaClinicaUseCase', () => {
  let useCase: CrearHistoriaClinicaUseCase;
  let mockRepository: MockRepository;
  let mockPacienteValidator: MockPacienteValidator;
  let mockOdontologoContext: MockOdontologoContext;

  beforeEach(() => {
    mockRepository = {
      guardar: vi.fn().mockResolvedValue(undefined),
      buscarPorId: vi.fn(),
      buscarPorPacienteId: vi.fn(),
      existePorPacienteId: vi.fn().mockResolvedValue(false),
      actualizar: vi.fn(),
    };

    mockPacienteValidator = {
      existePaciente: vi.fn().mockResolvedValue(true),
    };

    mockOdontologoContext = {
      obtenerOdontologoActual: vi.fn().mockResolvedValue({
        odontologoId: 'od_operador_001',
      }),
    };

    useCase = new CrearHistoriaClinicaUseCase(
      mockRepository as unknown as IHistoriaClinicaRepository,
      mockPacienteValidator as unknown as IPacienteValidatorPort,
      mockOdontologoContext as unknown as IOdontologoContextPort,
    );
  });

  it('debe crear y persistir una historia clínica exitosamente con valores por defecto', async () => {
    const result = await useCase.execute({
      tokenAutenticacion: 'token_valido_123',
      pacienteId: 'pac_test_100',
    });

    expect(mockOdontologoContext.obtenerOdontologoActual).toHaveBeenCalledWith('token_valido_123');
    expect(mockPacienteValidator.existePaciente).toHaveBeenCalledWith('pac_test_100');
    expect(mockRepository.existePorPacienteId).toHaveBeenCalled();
    expect(mockRepository.guardar).toHaveBeenCalledTimes(1);

    expect(result.id).toMatch(/^hc_/);
    expect(result.pacienteId).toBe('pac_test_100');
    expect(result.odontologoResponsableId).toBe('od_operador_001'); // fallback al operador
    expect(result.estado).toBe(EstadoHistoria.ACTIVA);
    expect(result.version).toBe(1);
    expect(result.alergias).toHaveLength(0);
    expect(result.medicamentosActuales).toHaveLength(0);
    expect(result.historialCambios).toHaveLength(1);
    expect(result.historialCambios[0].accion).toBe(AccionAuditoria.CREACION);
    expect(result.historialCambios[0].odontologoId).toBe('od_operador_001');
  });

  it('debe respetar el odontologoResponsableId si se especifica explícitamente', async () => {
    const result = await useCase.execute({
      tokenAutenticacion: 'token_valido_123',
      pacienteId: 'pac_test_100',
      odontologoResponsableId: 'od_especialista_999',
    });

    expect(result.odontologoResponsableId).toBe('od_especialista_999');
    expect(result.historialCambios[0].odontologoId).toBe('od_operador_001'); // creador registrado en auditoría
  });

  it('debe mapear antecedentes estructurados si se envían en el comando', async () => {
    const result = await useCase.execute({
      tokenAutenticacion: 'token_valido_123',
      pacienteId: 'pac_test_100',
      antecedentes: {
        enfermedadesCronicas: [
          {
            nombre: 'Diabetes Mellitus Tipo 2',
            estado: 'CONFIRMADO',
            detalle: 'Controlada con metformina 850mg',
          },
        ],
        antecedentesOdontologicos: {
          bruxismo: {
            estado: 'CONFIRMADO',
            detalle: 'Desgaste incisal visible',
          },
        },
      },
      observacionesGenerales: 'Paciente derivado para exodoncia.',
    });

    expect(result.antecedentes.enfermedadesCronicas).toHaveLength(1);
    expect(result.antecedentes.enfermedadesCronicas[0].estado).toBe('CONFIRMADO');
    expect(result.antecedentes.enfermedadesCronicas[0].detalle).toBe(
      'Controlada con metformina 850mg',
    );
    expect(result.antecedentes.antecedentesOdontologicos.bruxismo.estado).toBe('CONFIRMADO');
    expect(result.observacionesGenerales).toBe('Paciente derivado para exodoncia.');
  });

  it('debe lanzar AutenticacionRequeridaError si el token es ausente o vacío', async () => {
    await expect(
      useCase.execute({
        tokenAutenticacion: '',
        pacienteId: 'pac_test_100',
      }),
    ).rejects.toThrow(AutenticacionRequeridaError);

    await expect(
      useCase.execute({
        tokenAutenticacion: '   ',
        pacienteId: 'pac_test_100',
      }),
    ).rejects.toThrow(AutenticacionRequeridaError);
  });

  it('debe lanzar PacienteInexistenteError si el validador confirma que el paciente no existe', async () => {
    mockPacienteValidator.existePaciente.mockResolvedValue(false);

    await expect(
      useCase.execute({
        tokenAutenticacion: 'token_valido_123',
        pacienteId: 'pac_no_existe',
      }),
    ).rejects.toThrow(PacienteInexistenteError);

    expect(mockRepository.guardar).not.toHaveBeenCalled();
  });

  it('debe propagar PacienteNoDisponibleError sin crear historia si MS1 falla o sufre timeout', async () => {
    mockPacienteValidator.existePaciente.mockRejectedValue(
      new PacienteNoDisponibleError('Timeout tras 2000ms consultando MS1'),
    );

    await expect(
      useCase.execute({
        tokenAutenticacion: 'token_valido_123',
        pacienteId: '33333333-3333-4333-8333-333333333333',
      }),
    ).rejects.toThrow(PacienteNoDisponibleError);

    expect(mockRepository.guardar).not.toHaveBeenCalled();
  });

  it('debe propagar AutenticacionMs1Error si las credenciales de servicio con MS1 son inválidas', async () => {
    mockPacienteValidator.existePaciente.mockRejectedValue(
      new AutenticacionMs1Error(401, 'Token inválido'),
    );

    await expect(
      useCase.execute({
        tokenAutenticacion: 'token_valido_123',
        pacienteId: '33333333-3333-4333-8333-333333333333',
      }),
    ).rejects.toThrow(AutenticacionMs1Error);

    expect(mockRepository.guardar).not.toHaveBeenCalled();
  });

  it('debe lanzar HistoriaClinicaDuplicadaError si ya existe un expediente para ese paciente (INV-01)', async () => {
    mockRepository.existePorPacienteId.mockResolvedValue(true);

    await expect(
      useCase.execute({
        tokenAutenticacion: 'token_valido_123',
        pacienteId: 'pac_con_expediente',
      }),
    ).rejects.toThrow(HistoriaClinicaDuplicadaError);

    expect(mockRepository.guardar).not.toHaveBeenCalled();
  });

  it('debe admitir un UUID estándar de MS1 para PacienteId y crear la historia exitosamente', async () => {
    const ms1Uuid = '33333333-3333-4333-8333-333333333333';
    mockPacienteValidator.existePaciente.mockResolvedValue(true);

    const result = await useCase.execute({
      tokenAutenticacion: 'token_valido_123',
      pacienteId: ms1Uuid,
    });

    expect(mockPacienteValidator.existePaciente).toHaveBeenCalledWith(ms1Uuid);
    expect(result.pacienteId).toBe(ms1Uuid);
    expect(mockRepository.guardar).toHaveBeenCalledTimes(1);
  });
});
