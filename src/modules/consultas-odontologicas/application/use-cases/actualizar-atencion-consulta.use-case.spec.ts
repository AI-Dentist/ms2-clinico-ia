import { describe, it, expect, vi, beforeEach } from 'vitest';
import { ActualizarAtencionConsultaUseCase } from './actualizar-atencion-consulta.use-case.js';
import type { IConsultaOdontologicaRepositoryPort } from '../../domain/ports/consulta-odontologica.repository.port.js';
import type { IOdontologoContextPort } from '../../domain/ports/odontologo-context.port.js';
import { ConsultaNoEncontradaError } from '../../domain/errors/consulta-no-encontrada.error.js';
import { ConflictoConcurrenteConsultaError } from '../../domain/errors/conflicto-concurrente-consulta.error.js';
import { ConsultaNoEditableError } from '../../domain/errors/consulta-no-editable.error.js';
import { PiezaDentalFDIInvalidaError } from '../../domain/errors/pieza-dental-fdi-invalida.error.js';
import { AutenticacionRequeridaError } from '../errors/autenticacion-requerida.error.js';
import { ConsultaOdontologica } from '../../domain/entities/consulta-odontologica.entity.js';
import { HistoriaClinicaId } from '../../domain/value-objects/historia-clinica-id.vo.js';
import { PacienteId } from '../../domain/value-objects/paciente-id.vo.js';
import { OdontologoId } from '../../domain/value-objects/odontologo-id.vo.js';
import { MotivoConsulta } from '../../domain/value-objects/motivo-consulta.vo.js';
import { SnapshotRiesgoClinico } from '../../domain/value-objects/snapshot-riesgo-clinico.vo.js';
import { TipoDiagnostico } from '../../domain/value-objects/tipo-diagnostico.enum.js';

describe('ActualizarAtencionConsultaUseCase', () => {
  let useCase: ActualizarAtencionConsultaUseCase;
  let mockRepository: { [K in keyof IConsultaOdontologicaRepositoryPort]: ReturnType<typeof vi.fn> };
  let mockOdontologoContext: { [K in keyof IOdontologoContextPort]: ReturnType<typeof vi.fn> };

  const relojFijo = new Date('2026-10-22T10:30:00.000Z');

  const crearConsultaMock = (): ConsultaOdontologica => {
    return ConsultaOdontologica.abrir({
      historiaClinicaId: HistoriaClinicaId.crear('hc_123'),
      pacienteId: PacienteId.crear('pac_123'),
      odontologoId: OdontologoId.crear('od_001'),
      versionHistoriaReferenciada: 1,
      snapshotRiesgoClinico: SnapshotRiesgoClinico.vacio(),
      motivoConsulta: MotivoConsulta.crear('Dolor en pieza 36'),
    });
  };

  beforeEach(() => {
    mockRepository = {
      guardar: vi.fn(),
      actualizar: vi.fn().mockResolvedValue(undefined),
      buscarPorId: vi.fn(),
      buscarPorCitaId: vi.fn(),
      listarPorHistoriaClinica: vi.fn(),
      listarPorPacienteId: vi.fn(),
    };

    mockOdontologoContext = {
      obtenerOdontologoActual: vi.fn().mockResolvedValue({ odontologoId: 'od_001' }),
    };

    useCase = new ActualizarAtencionConsultaUseCase(
      mockRepository as unknown as IConsultaOdontologicaRepositoryPort,
      mockOdontologoContext as unknown as IOdontologoContextPort
    );
  });

  it('debe actualizar los datos clínicos y avanzar la versión con concurrencia optimista', async () => {
    const consulta = crearConsultaMock();
    mockRepository.buscarPorId.mockResolvedValue(consulta);

    const result = await useCase.execute(
      {
        tokenAutenticacion: 'token_valido',
        consultaId: consulta.id.valor,
        versionEsperada: 1,
        anamnesisActual: {
          descripcion: 'Dolor pulsátil nocturno continuo',
          tiempoEvolucion: '48h',
          escalaDolorEVA: 8,
        },
        exploracionFisica: {
          inspeccionIntraoral: 'Caries penetrante en 36 con percusión axial positiva',
        },
        diagnosticos: [
          {
            codigoCIE10: 'K04.0',
            descripcion: 'Pulpitis irreversible sintomática',
            tipo: TipoDiagnostico.DEFINITIVO,
          },
        ],
        procedimientosRealizados: [
          {
            codigo: 'END-01',
            descripcion: 'Pulpectomía cameral',
            piezaDental: 36, // Válido FDI
          },
        ],
        recomendaciones: 'AINEs cada 8 horas por 3 días',
      },
      relojFijo
    );

    expect(result.version).toBe(2);
    expect(result.actualizadoEn).toBe(relojFijo.toISOString());
    expect(result.anamnesisActual.escalaDolorEVA).toBe(8);
    expect(result.diagnosticos.length).toBe(1);
    expect(result.procedimientosRealizados[0].piezaDental).toBe(36);
    expect(mockRepository.actualizar).toHaveBeenCalledWith(consulta, 1);
  });

  it('debe rechazar si no se envía token de autenticación', async () => {
    await expect(
      useCase.execute({
        tokenAutenticacion: '',
        consultaId: 'cons_123',
        versionEsperada: 1,
      })
    ).rejects.toThrow(AutenticacionRequeridaError);
  });

  it('debe rechazar si la consulta no existe', async () => {
    mockRepository.buscarPorId.mockResolvedValue(null);

    await expect(
      useCase.execute({
        tokenAutenticacion: 'token_valido',
        consultaId: 'cons_no_existe',
        versionEsperada: 1,
      })
    ).rejects.toThrow(ConsultaNoEncontradaError);
  });

  it('debe rechazar si la versionEsperada no coincide con la versión en memoria (INV-CONS-09)', async () => {
    const consulta = crearConsultaMock(); // versión actual = 1
    mockRepository.buscarPorId.mockResolvedValue(consulta);

    await expect(
      useCase.execute({
        tokenAutenticacion: 'token_valido',
        consultaId: consulta.id.valor,
        versionEsperada: 99, // Desincronizado
      })
    ).rejects.toThrow(ConflictoConcurrenteConsultaError);
  });

  it('debe rechazar si la consulta ya fue completada (INV-CONS-04)', async () => {
    const consulta = crearConsultaMock();
    consulta.actualizarAtencion({
      exploracionFisica: {
        inspeccionIntraoral: 'Exploración completa',
        tieneInspeccionIntraoral: true,
      } as any,
      diagnosticos: [{ descripcion: 'Caries', tipo: TipoDiagnostico.DEFINITIVO }] as any,
      actualizadoPor: OdontologoId.crear('od_001'),
    });
    consulta.completar(OdontologoId.crear('od_001'));
    mockRepository.buscarPorId.mockResolvedValue(consulta);

    await expect(
      useCase.execute({
        tokenAutenticacion: 'token_valido',
        consultaId: consulta.id.valor,
        versionEsperada: consulta.version,
        recomendaciones: 'Intento de edición post-cierre',
      })
    ).rejects.toThrow(ConsultaNoEditableError);
  });

  it('debe rechazar si se incluye un procedimiento con pieza dental FDI inválida (INV-CONS-08)', async () => {
    const consulta = crearConsultaMock();
    mockRepository.buscarPorId.mockResolvedValue(consulta);

    await expect(
      useCase.execute({
        tokenAutenticacion: 'token_valido',
        consultaId: consulta.id.valor,
        versionEsperada: 1,
        procedimientosRealizados: [
          {
            descripcion: 'Extracción en diente inexistente',
            piezaDental: 29, // Inválido
          },
        ],
      })
    ).rejects.toThrow(PiezaDentalFDIInvalidaError);
  });
});
