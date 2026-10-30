import { describe, it, expect, beforeEach, vi } from 'vitest';
import { BadRequestException } from '@nestjs/common';
import { EstudiosController } from './estudios.controller.js';
import type {
  CrearSolicitudEstudioUseCase,
  ListarSolicitudesPorConsultaUseCase,
  ListarSolicitudesPorHistoriaUseCase,
  ObtenerSolicitudEstudioPorIdUseCase,
  CambiarEstadoSolicitudUseCase,
  RegistrarResultadoEstudioUseCase,
  AdjuntarArchivoEstudioUseCase,
} from '../../../application/use-cases/solicitudes-estudio.use-cases.js';
import type { AnalizarRadiografiaUseCase } from '../../../../ia-diagnostico/application/use-cases/analizar-radiografia.use-case.js';
import { PrioridadEstudio } from '../../../domain/enums/prioridad-estudio.enum.js';
import { EstadoSolicitudEstudio } from '../../../domain/enums/estado-solicitud-estudio.enum.js';
import { HallazgoIa } from '../../../../ia-diagnostico/domain/enums/hallazgo-ia.enum.js';
import { SeveridadLesion } from '../../../../ia-diagnostico/domain/enums/severidad-lesion.enum.js';
import type { SolicitudEstudioDto } from '../../../application/dtos/estudios.dtos.js';

describe('EstudiosController', () => {
  let controller: EstudiosController;
  let mockCrearUseCase: Partial<CrearSolicitudEstudioUseCase>;
  let mockListarPorConsultaUseCase: Partial<ListarSolicitudesPorConsultaUseCase>;
  let mockListarPorHistoriaUseCase: Partial<ListarSolicitudesPorHistoriaUseCase>;
  let mockObtenerPorIdUseCase: Partial<ObtenerSolicitudEstudioPorIdUseCase>;
  let mockCambiarEstadoUseCase: Partial<CambiarEstadoSolicitudUseCase>;
  let mockRegistrarResultadoUseCase: Partial<RegistrarResultadoEstudioUseCase>;
  let mockAdjuntarArchivoUseCase: Partial<AdjuntarArchivoEstudioUseCase>;
  let mockAnalizarRadiografiaUseCase: Partial<AnalizarRadiografiaUseCase>;

  const mockSolicitudDto: SolicitudEstudioDto = {
    id: 'sol_test_123',
    historiaClinicaId: 'hc_123',
    consultaId: 'cons_123',
    pacienteId: 'pac_123',
    odontologoId: 'od_123',
    tipoEstudioId: 'tipo_rx',
    motivo: 'Evaluación molar',
    indicaciones: null,
    prioridad: PrioridadEstudio.RUTINA,
    estado: EstadoSolicitudEstudio.SOLICITADO,
    fechaSolicitud: '2026-10-30T10:00:00.000Z',
    motivoCancelacion: null,
    resultado: null,
    creadoEn: '2026-10-30T10:00:00.000Z',
    actualizadoEn: '2026-10-30T10:00:00.000Z',
  };

  beforeEach(() => {
    mockCrearUseCase = {
      execute: vi.fn().mockResolvedValue(mockSolicitudDto),
    };
    mockListarPorConsultaUseCase = {
      execute: vi.fn().mockResolvedValue([mockSolicitudDto]),
    };
    mockListarPorHistoriaUseCase = {
      execute: vi.fn().mockResolvedValue([mockSolicitudDto]),
    };
    mockObtenerPorIdUseCase = {
      execute: vi.fn().mockResolvedValue(mockSolicitudDto),
    };
    mockCambiarEstadoUseCase = {
      execute: vi.fn().mockResolvedValue({
        ...mockSolicitudDto,
        estado: EstadoSolicitudEstudio.EN_PROCESO,
      }),
    };
    mockRegistrarResultadoUseCase = {
      execute: vi.fn().mockResolvedValue({
        ...mockSolicitudDto,
        estado: EstadoSolicitudEstudio.COMPLETADO,
        resultado: {
          id: 'res_123',
          solicitudEstudioId: 'sol_test_123',
          laboratorioId: null,
          fechaResultado: '2026-10-30T10:00:00.000Z',
          registradoPor: 'od_123',
          resumen: 'Resultado normal',
          observaciones: null,
          valoresReferencia: [],
          archivoAdjunto: null,
          registradoEn: '2026-10-30T10:00:00.000Z',
        },
      }),
    };
    mockAdjuntarArchivoUseCase = {
      execute: vi.fn().mockResolvedValue({
        ...mockSolicitudDto,
        estado: EstadoSolicitudEstudio.COMPLETADO,
        resultado: {
          id: 'res_123',
          solicitudEstudioId: 'sol_test_123',
          laboratorioId: null,
          fechaResultado: '2026-10-30T10:00:00.000Z',
          registradoPor: 'od_123',
          resumen: 'Archivo adjunto',
          observaciones: null,
          valoresReferencia: [],
          archivoAdjunto: {
            urlArchivo: '/uploads/estudios/rx.png',
            nombreArchivo: 'rx.png',
            mimeType: 'image/png',
            tamanioBytes: 2048,
          },
          registradoEn: '2026-10-30T10:00:00.000Z',
        },
      }),
    };
    mockAnalizarRadiografiaUseCase = {
      execute: vi.fn().mockResolvedValue({
        id: 'an_ia_test',
        probabilidadCaries: 0.85,
        probabilidadSano: 0.15,
        confianza: 0.85,
        hallazgo: HallazgoIa.CARIES_DETECTADA,
        severidad: SeveridadLesion.SEVERA,
        clasificacion: 'Caries cavitada',
        tiempoInferenciaMs: 12.5,
        recomendacionClinica: 'Confirmación clínica',
        modeloInfo: {
          nombre: 'DeepDental-CNN',
          arquitectura: 'CNN-2D-DeepDental-v1',
          version: '1.0.0',
        },
        metadataImagen: {
          nombreArchivo: 'rx.png',
          mimeType: 'image/png',
          tamanioBytes: 2048,
          anchoOriginal: 64,
          altoOriginal: 64,
          canales: 1,
        },
        fechaAnalisis: '2026-10-30T10:00:00.000Z',
      }),
    };

    controller = new EstudiosController(
      mockCrearUseCase as CrearSolicitudEstudioUseCase,
      mockListarPorConsultaUseCase as ListarSolicitudesPorConsultaUseCase,
      mockListarPorHistoriaUseCase as ListarSolicitudesPorHistoriaUseCase,
      mockObtenerPorIdUseCase as ObtenerSolicitudEstudioPorIdUseCase,
      mockCambiarEstadoUseCase as CambiarEstadoSolicitudUseCase,
      mockRegistrarResultadoUseCase as RegistrarResultadoEstudioUseCase,
      mockAdjuntarArchivoUseCase as AdjuntarArchivoEstudioUseCase,
      mockAnalizarRadiografiaUseCase as AnalizarRadiografiaUseCase,
    );
  });

  it('debe estar definido', () => {
    expect(controller).toBeDefined();
  });

  it('debe crear una solicitud de estudio clínico', async () => {
    const mockReq = { operadorToken: 'token_valido' } as any;
    const dto = {
      consultaId: 'cons_123',
      tipoEstudioId: 'tipo_rx',
      motivo: 'Evaluación molar',
      prioridad: PrioridadEstudio.RUTINA,
    };

    const res = await controller.crearSolicitud(dto, mockReq);
    expect(res).toEqual(mockSolicitudDto);
    expect(mockCrearUseCase.execute).toHaveBeenCalledWith(
      expect.objectContaining({
        consultaId: 'cons_123',
        tipoEstudioId: 'tipo_rx',
        tokenOdontologo: 'token_valido',
      }),
    );
  });

  it('debe adjuntar un archivo médico a una solicitud existente', async () => {
    const mockReq = { operadorToken: 'token_valido' } as any;
    const mockFile: Express.Multer.File = {
      fieldname: 'archivo',
      originalname: 'rx.png',
      encoding: '7bit',
      mimetype: 'image/png',
      buffer: Buffer.from('fake-image-bytes'),
      size: 2048,
      stream: null as any,
      destination: '',
      filename: '',
      path: '',
    };

    const res = await controller.adjuntarArchivo('sol_test_123', mockReq, mockFile);
    expect(res.resultado?.archivoAdjunto?.nombreArchivo).toBe('rx.png');
    expect(mockAdjuntarArchivoUseCase.execute).toHaveBeenCalledWith(
      expect.objectContaining({
        solicitudId: 'sol_test_123',
        tokenOdontologo: 'token_valido',
        archivoAdjunto: expect.objectContaining({
          nombreArchivo: 'rx.png',
          mimeType: 'image/png',
          tamanioBytes: 2048,
        }),
      }),
    );
  });

  it('debe lanzar BadRequestException al adjuntar archivo si file está ausente', async () => {
    const mockReq = { operadorToken: 'token_valido' } as any;
    await expect(controller.adjuntarArchivo('sol_test_123', mockReq, undefined)).rejects.toThrow(
      BadRequestException,
    );
  });

  it('debe analizar radiografía delegando al servicio de inferencia CNN', async () => {
    const mockFile: Express.Multer.File = {
      fieldname: 'archivo',
      originalname: 'rx.png',
      encoding: '7bit',
      mimetype: 'image/png',
      buffer: Buffer.from('fake-image-bytes'),
      size: 2048,
      stream: null as any,
      destination: '',
      filename: '',
      path: '',
    };

    const res = await controller.analizarRadiografia(mockFile);
    expect(res.hallazgo).toBe(HallazgoIa.CARIES_DETECTADA);
    expect(res.probabilidadCaries).toBe(0.85);
    expect(mockAnalizarRadiografiaUseCase.execute).toHaveBeenCalled();
  });

  it('debe lanzar BadRequestException al analizar radiografía si file está ausente o vacío', async () => {
    await expect(controller.analizarRadiografia(undefined)).rejects.toThrow(BadRequestException);

    const emptyFile = {
      buffer: Buffer.alloc(0),
    } as any;
    await expect(controller.analizarRadiografia(emptyFile)).rejects.toThrow(BadRequestException);
  });
});
