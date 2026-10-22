import { describe, it, expect, vi, beforeEach } from 'vitest';
import { RegistrarAperturaConsultaUseCase } from './registrar-apertura-consulta.use-case.js';
import type { IConsultaOdontologicaRepositoryPort } from '../../domain/ports/consulta-odontologica.repository.port.js';
import type { IHistoriaClinicaContextPort } from '../../domain/ports/historia-clinica-context.port.js';
import type { ICitaValidatorPort } from '../../domain/ports/cita-validator.port.js';
import type { IOdontologoContextPort } from '../../domain/ports/odontologo-context.port.js';
import { HistoriaClinicaNoHabilitadaError } from '../../domain/errors/historia-clinica-no-habilitada.error.js';
import { CitaInvalidaParaConsultaError } from '../../domain/errors/cita-invalida-para-consulta.error.js';
import { PiezaDentalFDIInvalidaError } from '../../domain/errors/pieza-dental-fdi-invalida.error.js';
import { AutenticacionRequeridaError } from '../errors/autenticacion-requerida.error.js';
import { PacienteNoCoincideError } from '../errors/paciente-no-coincide.error.js';
import { EstadoConsulta } from '../../domain/value-objects/estado-consulta.enum.js';
import { ConsultaOdontologica } from '../../domain/entities/consulta-odontologica.entity.js';
import { MotivoConsulta } from '../../domain/value-objects/motivo-consulta.vo.js';
import { HistoriaClinicaId } from '../../domain/value-objects/historia-clinica-id.vo.js';
import { PacienteId } from '../../domain/value-objects/paciente-id.vo.js';
import { OdontologoId } from '../../domain/value-objects/odontologo-id.vo.js';
import { SnapshotRiesgoClinico } from '../../domain/value-objects/snapshot-riesgo-clinico.vo.js';

type MockRepository = {
  [K in keyof IConsultaOdontologicaRepositoryPort]: ReturnType<typeof vi.fn>;
};

type MockHistoriaContext = {
  [K in keyof IHistoriaClinicaContextPort]: ReturnType<typeof vi.fn>;
};

type MockCitaValidator = {
  [K in keyof ICitaValidatorPort]: ReturnType<typeof vi.fn>;
};

type MockOdontologoContext = {
  [K in keyof IOdontologoContextPort]: ReturnType<typeof vi.fn>;
};

describe('RegistrarAperturaConsultaUseCase', () => {
  let useCase: RegistrarAperturaConsultaUseCase;
  let mockRepository: MockRepository;
  let mockHistoriaContext: MockHistoriaContext;
  let mockCitaValidator: MockCitaValidator;
  let mockOdontologoContext: MockOdontologoContext;

  const relojFijo = new Date('2026-10-22T10:00:00.000Z');

  beforeEach(() => {
    mockRepository = {
      guardar: vi.fn().mockResolvedValue(undefined),
      actualizar: vi.fn().mockResolvedValue(undefined),
      buscarPorId: vi.fn(),
      buscarPorCitaId: vi.fn().mockResolvedValue(null),
      listarPorHistoriaClinica: vi.fn(),
      listarPorPacienteId: vi.fn(),
    };

    mockHistoriaContext = {
      obtenerResumenParaApertura: vi.fn().mockResolvedValue({
        existe: true,
        pacienteId: 'pac_test_001',
        estado: 'ACTIVA',
        versionActual: 3,
        alergiasCriticas: [{ sustancia: 'Lidocaína', severidad: 'GRAVE' }],
        condicionesMedicas: ['Hipertensión arterial'],
        medicacionHabitual: ['Enalapril 10mg'],
      }),
    };

    mockCitaValidator = {
      validarCitaParaAtencion: vi.fn().mockResolvedValue({ esValida: true }),
    };

    mockOdontologoContext = {
      obtenerOdontologoActual: vi.fn().mockResolvedValue({
        odontologoId: 'od_henry_001',
      }),
    };

    useCase = new RegistrarAperturaConsultaUseCase(
      mockRepository as unknown as IConsultaOdontologicaRepositoryPort,
      mockHistoriaContext as unknown as IHistoriaClinicaContextPort,
      mockCitaValidator as unknown as ICitaValidatorPort,
      mockOdontologoContext as unknown as IOdontologoContextPort
    );
  });

  it('debe registrar la apertura de una consulta de urgencia sin cita agendada exitosamente', async () => {
    const result = await useCase.execute(
      {
        tokenAutenticacion: 'token_valido',
        historiaClinicaId: 'hc_12345678-aaaa-bbbb',
        pacienteId: 'pac_test_001',
        motivoConsulta: 'Dolor punzante espontáneo en molar inferior',
      },
      relojFijo
    );

    expect(result.id.startsWith('cons_')).toBe(true);
    expect(result.estado).toBe(EstadoConsulta.EN_CURSO);
    expect(result.version).toBe(1);
    expect(result.citaId).toBeNull();
    expect(result.odontologoId).toBe('od_henry_001');
    expect(result.versionHistoriaReferenciada).toBe(3);
    expect(result.snapshotRiesgoClinico.alergiasCriticas.length).toBe(1);
    expect(result.snapshotRiesgoClinico.condicionesMedicas).toContain('Hipertensión arterial');
    expect(mockRepository.guardar).toHaveBeenCalledTimes(1);
  });

  it('debe registrar apertura vinculando una cita programada válida en MS3', async () => {
    const result = await useCase.execute(
      {
        tokenAutenticacion: 'token_valido',
        historiaClinicaId: 'hc_12345678-aaaa-bbbb',
        pacienteId: 'pac_test_001',
        citaId: 'cita_dev_001',
        motivoConsulta: 'Control de tratamiento periodontal',
      },
      relojFijo
    );

    expect(result.citaId).toBe('cita_dev_001');
    expect(mockCitaValidator.validarCitaParaAtencion).toHaveBeenCalledWith('cita_dev_001', 'pac_test_001');
    expect(mockRepository.buscarPorCitaId).toHaveBeenCalled();
    expect(mockRepository.guardar).toHaveBeenCalled();
  });

  it('debe rechazar apertura si no se proporciona token de autenticación', async () => {
    await expect(
      useCase.execute({
        tokenAutenticacion: '',
        historiaClinicaId: 'hc_123',
        pacienteId: 'pac_123',
        motivoConsulta: 'Motivo',
      })
    ).rejects.toThrow(AutenticacionRequeridaError);
  });

  it('debe rechazar si la historia clínica no existe (INV-CONS-02)', async () => {
    mockHistoriaContext.obtenerResumenParaApertura.mockResolvedValue(null);

    await expect(
      useCase.execute({
        tokenAutenticacion: 'token_valido',
        historiaClinicaId: 'hc_inexistente',
        pacienteId: 'pac_test_001',
        motivoConsulta: 'Dolor dental agudo',
      })
    ).rejects.toThrow(HistoriaClinicaNoHabilitadaError);
  });

  it('debe rechazar si la historia clínica se encuentra CERRADA o ARCHIVADA (INV-CONS-02)', async () => {
    mockHistoriaContext.obtenerResumenParaApertura.mockResolvedValue({
      existe: true,
      pacienteId: 'pac_test_001',
      estado: 'CERRADA',
      versionActual: 2,
      alergiasCriticas: [],
      condicionesMedicas: [],
      medicacionHabitual: [],
    });

    await expect(
      useCase.execute({
        tokenAutenticacion: 'token_valido',
        historiaClinicaId: 'hc_cerrada',
        pacienteId: 'pac_test_001',
        motivoConsulta: 'Consulta no permitida',
      })
    ).rejects.toThrow(HistoriaClinicaNoHabilitadaError);
  });

  it('debe rechazar si el paciente indicado no coincide con el titular del expediente', async () => {
    await expect(
      useCase.execute({
        tokenAutenticacion: 'token_valido',
        historiaClinicaId: 'hc_12345678-aaaa-bbbb',
        pacienteId: 'pac_impostor_999',
        motivoConsulta: 'Dolor molar severo',
      })
    ).rejects.toThrow(PacienteNoCoincideError);
  });

  it('debe rechazar si la cita referenciada ya fue utilizada en otra consulta (INV-CONS-07)', async () => {
    // Simular que ya existe una consulta con esa cita en el repositorio
    const consultaExistente = ConsultaOdontologica.abrir({
      historiaClinicaId: HistoriaClinicaId.crear('hc_12345678-aaaa-bbbb'),
      pacienteId: PacienteId.crear('pac_test_001'),
      odontologoId: OdontologoId.crear('od_otro_002'),
      versionHistoriaReferenciada: 1,
      snapshotRiesgoClinico: SnapshotRiesgoClinico.vacio(),
      motivoConsulta: MotivoConsulta.crear('Atención previa'),
    });
    mockRepository.buscarPorCitaId.mockResolvedValue(consultaExistente);

    await expect(
      useCase.execute({
        tokenAutenticacion: 'token_valido',
        historiaClinicaId: 'hc_12345678-aaaa-bbbb',
        pacienteId: 'pac_test_001',
        citaId: 'cita_dev_001',
        motivoConsulta: 'Consulta duplicada',
      })
    ).rejects.toThrow(CitaInvalidaParaConsultaError);
  });

  it('debe rechazar si el validador de MS3 determina que la cita es inválida o ajena', async () => {
    mockCitaValidator.validarCitaParaAtencion.mockResolvedValue({
      esValida: false,
      motivoInvalidez: 'La cita pertenece a otro paciente en MS3',
    });

    await expect(
      useCase.execute({
        tokenAutenticacion: 'token_valido',
        historiaClinicaId: 'hc_12345678-aaaa-bbbb',
        pacienteId: 'pac_test_001',
        citaId: 'cita_ajena_888',
        motivoConsulta: 'Consulta con cita ajena',
      })
    ).rejects.toThrow(CitaInvalidaParaConsultaError);
  });

  it('debe rechazar apertura si se incluye un procedimiento con pieza dental no FDI (INV-CONS-08)', async () => {
    await expect(
      useCase.execute({
        tokenAutenticacion: 'token_valido',
        historiaClinicaId: 'hc_12345678-aaaa-bbbb',
        pacienteId: 'pac_test_001',
        motivoConsulta: 'Atención con diente inválido',
        procedimientosRealizados: [
          {
            descripcion: 'Obturación en pieza inexistente',
            piezaDental: 99, // Inválido bajo FDI
          },
        ],
      })
    ).rejects.toThrow(PiezaDentalFDIInvalidaError);
  });
});
