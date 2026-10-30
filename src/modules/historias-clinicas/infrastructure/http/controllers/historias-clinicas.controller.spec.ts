import { describe, it, expect, beforeEach, vi } from 'vitest';
import { BadRequestException } from '@nestjs/common';
import { HistoriasClinicasController } from './historias-clinicas.controller.js';
import type {
  CrearHistoriaClinicaUseCase,
  ObtenerHistoriaPorIdUseCase,
  ObtenerHistoriaPorPacienteUseCase,
  ActualizarAntecedentesUseCase,
  AgregarAlergiaUseCase,
  EliminarAlergiaUseCase,
  ActualizarMedicamentosUseCase,
  CambiarEstadoHistoriaUseCase,
  HistoriaClinicaResponseDto,
} from '../../../application/index.js';
import { EstadoHistoria } from '../../../domain/value-objects/estado-historia.enum.js';
import { SeveridadAlergia } from '../../../domain/value-objects/severidad-alergia.enum.js';

describe('HistoriasClinicasController', () => {
  let controller: HistoriasClinicasController;
  let mockCrearUseCase: Partial<CrearHistoriaClinicaUseCase>;
  let mockObtenerPorIdUseCase: Partial<ObtenerHistoriaPorIdUseCase>;
  let mockObtenerPorPacienteUseCase: Partial<ObtenerHistoriaPorPacienteUseCase>;
  let mockActualizarAntecedentesUseCase: Partial<ActualizarAntecedentesUseCase>;
  let mockAgregarAlergiaUseCase: Partial<AgregarAlergiaUseCase>;
  let mockEliminarAlergiaUseCase: Partial<EliminarAlergiaUseCase>;
  let mockActualizarMedicamentosUseCase: Partial<ActualizarMedicamentosUseCase>;
  let mockCambiarEstadoUseCase: Partial<CambiarEstadoHistoriaUseCase>;

  const mockResponseDto: HistoriaClinicaResponseDto = {
    id: 'hc-test-123',
    pacienteId: 'pac-001',
    odontologoResponsableId: 'od-001',
    estado: EstadoHistoria.ACTIVA,
    version: 1,
    antecedentes: {
      enfermedadesCronicas: [],
      antecedentesMedicos: [],
      antecedentesFamiliares: [],
      antecedentesOdontologicos: {
        tratamientoPrevio: { nombre: null, estado: 'NO_EVALUADO', detalle: null, registradoEn: null },
        protesisActual: { nombre: null, estado: 'NO_EVALUADO', detalle: null, registradoEn: null },
        sangradoGingival: { nombre: null, estado: 'NO_EVALUADO', detalle: null, registradoEn: null },
        bruxismo: { nombre: null, estado: 'NO_EVALUADO', detalle: null, registradoEn: null },
      },
    },
    alergias: [],
    medicamentosActuales: [],
    observacionesGenerales: null,
    historialCambios: [],
    creadoEn: '2026-10-22T10:00:00.000Z',
    actualizadoEn: '2026-10-22T10:00:00.000Z',
  };

  beforeEach(() => {
    mockCrearUseCase = {
      execute: vi.fn().mockResolvedValue(mockResponseDto),
    };
    mockObtenerPorIdUseCase = {
      execute: vi.fn().mockResolvedValue(mockResponseDto),
    };
    mockObtenerPorPacienteUseCase = {
      execute: vi.fn().mockResolvedValue(mockResponseDto),
    };
    mockActualizarAntecedentesUseCase = {
      execute: vi.fn().mockResolvedValue({ ...mockResponseDto, version: 2 }),
    };
    mockAgregarAlergiaUseCase = {
      execute: vi.fn().mockResolvedValue({ ...mockResponseDto, version: 2 }),
    };
    mockEliminarAlergiaUseCase = {
      execute: vi.fn().mockResolvedValue({ ...mockResponseDto, version: 2 }),
    };
    mockActualizarMedicamentosUseCase = {
      execute: vi.fn().mockResolvedValue({ ...mockResponseDto, version: 2 }),
    };
    mockCambiarEstadoUseCase = {
      execute: vi.fn().mockResolvedValue({
        ...mockResponseDto,
        estado: EstadoHistoria.CERRADA,
        version: 2,
      }),
    };

    controller = new HistoriasClinicasController(
      mockCrearUseCase as CrearHistoriaClinicaUseCase,
      mockObtenerPorIdUseCase as ObtenerHistoriaPorIdUseCase,
      mockObtenerPorPacienteUseCase as ObtenerHistoriaPorPacienteUseCase,
      mockActualizarAntecedentesUseCase as ActualizarAntecedentesUseCase,
      mockAgregarAlergiaUseCase as AgregarAlergiaUseCase,
      mockEliminarAlergiaUseCase as EliminarAlergiaUseCase,
      mockActualizarMedicamentosUseCase as ActualizarMedicamentosUseCase,
      mockCambiarEstadoUseCase as CambiarEstadoHistoriaUseCase,
    );
  });

  describe('crear', () => {
    it('debe invocar a CrearHistoriaClinicaUseCase con el token y DTO', async () => {
      const dto = {
        pacienteId: 'pac-001',
        odontologoResponsableId: 'od-001',
        antecedentes: {
          enfermedadesCronicas: [],
        },
        observacionesGenerales: 'Apertura inicial',
      };

      const result = await controller.crear('token_valido', dto);

      expect(mockCrearUseCase.execute).toHaveBeenCalledWith({
        tokenAutenticacion: 'token_valido',
        pacienteId: 'pac-001',
        odontologoResponsableId: 'od-001',
        antecedentes: dto.antecedentes,
        observacionesGenerales: 'Apertura inicial',
      });
      expect(result).toEqual(mockResponseDto);
    });

    it('debe asignar el odontologoId autenticado de la request si el DTO no lo especifica', async () => {
      const dto = {
        pacienteId: 'pac-001',
        odontologoResponsableId: '',
        antecedentes: { enfermedadesCronicas: [] },
      };
      const mockReq = {
        odontologoActual: { odontologoId: 'od_auth_123' },
      } as any;

      await controller.crear('token_valido', dto, mockReq);

      expect(mockCrearUseCase.execute).toHaveBeenCalledWith(
        expect.objectContaining({
          odontologoResponsableId: 'od_auth_123',
        }),
      );
    });

    it('debe rechazar con BadRequestException si el odontologoResponsableId no coincide con el operador autenticado', async () => {
      const dto = {
        pacienteId: 'pac-001',
        odontologoResponsableId: 'od_hacker_impostor',
        antecedentes: { enfermedadesCronicas: [] },
      };
      const mockReq = {
        odontologoActual: { odontologoId: 'od_auth_legit' },
      } as any;

      await expect(controller.crear('token_valido', dto, mockReq)).rejects.toThrow(
        BadRequestException,
      );
    });
  });

  describe('obtenerPorId', () => {
    it('debe invocar a ObtenerHistoriaPorIdUseCase con el ID', async () => {
      const result = await controller.obtenerPorId('token_valido', 'hc-test-123');

      expect(mockObtenerPorIdUseCase.execute).toHaveBeenCalledWith({
        id: 'hc-test-123',
      });
      expect(result).toEqual(mockResponseDto);
    });
  });

  describe('buscar', () => {
    it('debe retornar la historia clínica en un array al buscar por pacienteId', async () => {
      const result = await controller.buscar('token_valido', {
        pacienteId: 'pac-001',
      });

      expect(mockObtenerPorPacienteUseCase.execute).toHaveBeenCalledWith({
        pacienteId: 'pac-001',
      });
      expect(result).toEqual([mockResponseDto]);
    });

    it('debe arrojar BadRequestException si pacienteId está ausente o vacío', async () => {
      await expect(
        controller.buscar('token_valido', { pacienteId: '' as unknown as string }),
      ).rejects.toThrow(BadRequestException);

      await expect(
        controller.buscar('token_valido', { pacienteId: '   ' }),
      ).rejects.toThrow(BadRequestException);
    });
  });

  describe('actualizarAntecedentes', () => {
    it('debe invocar a ActualizarAntecedentesUseCase con los parámetros correspondientes', async () => {
      const dto = {
        versionEsperada: 1,
        nuevosAntecedentes: {
          enfermedadesCronicas: [
            { estado: 'CONFIRMADO' as const, detalle: 'Controlada' },
          ],
        },
        camposModificados: ['antecedentes.enfermedadesCronicas'],
        descripcion: 'Registro de HTA',
      };

      const result = await controller.actualizarAntecedentes(
        'token_valido',
        'hc-test-123',
        dto,
      );

      expect(mockActualizarAntecedentesUseCase.execute).toHaveBeenCalledWith({
        tokenAutenticacion: 'token_valido',
        historiaClinicaId: 'hc-test-123',
        versionEsperada: 1,
        nuevosAntecedentes: dto.nuevosAntecedentes,
        camposModificados: dto.camposModificados,
        descripcion: 'Registro de HTA',
      });
      expect(result.version).toBe(2);
    });
  });

  describe('agregarAlergia', () => {
    it('debe invocar a AgregarAlergiaUseCase con el payload correcto', async () => {
      const dto = {
        versionEsperada: 1,
        sustancia: 'Penicilina',
        tipoReaccion: 'Urticaria',
        severidad: SeveridadAlergia.GRAVE,
        notasAdicionales: 'Evitar betalactámicos',
        descripcion: 'Reportada por paciente',
      };

      const result = await controller.agregarAlergia('token_valido', 'hc-test-123', dto);

      expect(mockAgregarAlergiaUseCase.execute).toHaveBeenCalledWith({
        tokenAutenticacion: 'token_valido',
        historiaClinicaId: 'hc-test-123',
        versionEsperada: 1,
        alergia: {
          sustancia: 'Penicilina',
          tipoReaccion: 'Urticaria',
          severidad: SeveridadAlergia.GRAVE,
          notasAdicionales: 'Evitar betalactámicos',
        },
        descripcion: 'Reportada por paciente',
      });
      expect(result.version).toBe(2);
    });
  });

  describe('eliminarAlergia', () => {
    it('debe invocar a EliminarAlergiaUseCase con id, sustancia y versionEsperada', async () => {
      const dto = {
        versionEsperada: 1,
        descripcion: 'Descartada tras prueba clínica',
      };

      const result = await controller.eliminarAlergia(
        'token_valido',
        'hc-test-123',
        'Penicilina',
        dto,
      );

      expect(mockEliminarAlergiaUseCase.execute).toHaveBeenCalledWith({
        tokenAutenticacion: 'token_valido',
        historiaClinicaId: 'hc-test-123',
        versionEsperada: 1,
        sustancia: 'Penicilina',
        descripcion: 'Descartada tras prueba clínica',
      });
      expect(result.version).toBe(2);
    });
  });

  describe('actualizarMedicamentos', () => {
    it('debe invocar a ActualizarMedicamentosUseCase con el listado nuevo', async () => {
      const dto = {
        versionEsperada: 1,
        medicamentos: [
          {
            nombre: 'Ibuprofeno',
            dosis: '400mg',
            frecuencia: 'cada 8 horas',
          },
        ],
        descripcion: 'Prescripción posoperatoria',
      };

      const result = await controller.actualizarMedicamentos(
        'token_valido',
        'hc-test-123',
        dto,
      );

      expect(mockActualizarMedicamentosUseCase.execute).toHaveBeenCalledWith({
        tokenAutenticacion: 'token_valido',
        historiaClinicaId: 'hc-test-123',
        versionEsperada: 1,
        medicamentos: dto.medicamentos,
        descripcion: 'Prescripción posoperatoria',
      });
      expect(result.version).toBe(2);
    });
  });

  describe('cambiarEstado', () => {
    it('debe invocar a CambiarEstadoHistoriaUseCase con el nuevo estado', async () => {
      const dto = {
        versionEsperada: 1,
        nuevoEstado: EstadoHistoria.CERRADA,
        descripcion: 'Fin de tratamiento',
      };

      const result = await controller.cambiarEstado(
        'token_valido',
        'hc-test-123',
        dto,
      );

      expect(mockCambiarEstadoUseCase.execute).toHaveBeenCalledWith({
        tokenAutenticacion: 'token_valido',
        historiaClinicaId: 'hc-test-123',
        versionEsperada: 1,
        nuevoEstado: EstadoHistoria.CERRADA,
        descripcion: 'Fin de tratamiento',
      });
      expect(result.estado).toBe('CERRADA');
    });
  });
});
