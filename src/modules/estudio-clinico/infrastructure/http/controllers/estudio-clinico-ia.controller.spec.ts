import { describe, it, expect, beforeEach, vi } from 'vitest';
import { BadRequestException } from '@nestjs/common';
import { EstudioClinicoIaController } from './estudio-clinico-ia.controller.js';
import type { AnalizarImagenIaUseCase } from '../../../../ia-diagnostico/application/use-cases/analizar-imagen-ia.use-case.js';
import type { GuardarEstudioClinicoUseCase } from '../../../application/use-cases/guardar-estudio-clinico.use-case.js';
import type { ListarEstudiosPorPacienteUseCase } from '../../../application/use-cases/listar-estudios-por-paciente.use-case.js';
import type { AnalisisImagenIaDto } from '../../../../ia-diagnostico/application/dtos/analisis-imagen-ia.dto.js';
import type { EstudioClinicoDto } from '../../../application/dtos/estudio-clinico.dto.js';
import type { RequestConOperador } from '../../../../estudios/infrastructure/http/guards/odontologo-auth.guard.js';

describe('EstudioClinicoIaController', () => {
  let controller: EstudioClinicoIaController;
  let mockAnalizarImagenUseCase: Partial<AnalizarImagenIaUseCase>;
  let mockGuardarEstudioUseCase: Partial<GuardarEstudioClinicoUseCase>;
  let mockListarEstudiosUseCase: Partial<ListarEstudiosPorPacienteUseCase>;

  const mockAnalisisResult: AnalisisImagenIaDto = {
    hallazgos: [
      {
        etiqueta: 'caries_interproximal_o_oclusal',
        probabilidad: 0.88,
        severidad: 'ALTA',
        zonaSugerida: 'Cuadrante I – Superior Derecho (maxila derecha)',
        boundingBox: { x: 0.1, y: 0.2, width: 0.15, height: 0.2 },
        recomendacionClinica: 'Confirmar mediante exploración clínica.',
      },
    ],
    etiquetasNoSoportadas: [
      'reabsorcion_osea_periodontal',
      'restauracion_o_endodoncia_previa',
    ],
    modeloNombre: 'liodon-ai/dental-panoramic-detector',
    version: '1.0.0-yolo11n',
    fechaInferencia: '2026-11-08T10:00:00.000Z',
    confianzaGlobal: 0.88,
    severidadMaxima: 'ALTA',
    aviso: 'Apoyo de decisión clínica — CC-BY-NC-4.0',
  };

  const mockEstudioDto: EstudioClinicoDto = {
    id: 'estudio_123',
    pacienteId: 'pac_456',
    consultaId: 'cons_789',
    odontologoId: 'od_jwt_verified',
    analisisIa: {
      modeloNombre: 'liodon-ai/dental-panoramic-detector',
      version: '1.0.0-yolo11n',
      fechaInferencia: '2026-11-08T10:00:00.000Z',
      confianzaGlobal: 0.88,
      severidadMaxima: 'ALTA',
      hallazgos: mockAnalisisResult.hallazgos,
      observacionMedico: 'Caries visible en pieza 16',
    },
    imagenMimeType: 'image/png',
    imagenNombreArchivo: 'panoramica.png',
    creadoEn: '2026-11-08T10:05:00.000Z',
  };

  beforeEach(() => {
    mockAnalizarImagenUseCase = {
      execute: vi.fn().mockResolvedValue(mockAnalisisResult),
    };
    mockGuardarEstudioUseCase = {
      execute: vi.fn().mockResolvedValue(mockEstudioDto),
    };
    mockListarEstudiosUseCase = {
      execute: vi.fn().mockResolvedValue([mockEstudioDto]),
    };

    controller = new EstudioClinicoIaController(
      mockAnalizarImagenUseCase as AnalizarImagenIaUseCase,
      mockGuardarEstudioUseCase as GuardarEstudioClinicoUseCase,
      mockListarEstudiosUseCase as ListarEstudiosPorPacienteUseCase,
    );
  });

  describe('POST /api/expediente/estudios/analizar-imagen', () => {
    it('debe procesar exitosamente un archivo multipart', async () => {
      const mockFile: Express.Multer.File = {
        fieldname: 'archivo',
        originalname: 'panoramica.png',
        encoding: '7bit',
        mimetype: 'image/png',
        buffer: Buffer.from('fake-png-bytes'),
        size: 1024,
        stream: null as any,
        destination: '',
        filename: '',
        path: '',
      };

      const result = await controller.analizarImagen(mockFile, {});
      expect(result).toEqual(mockAnalisisResult);
      expect(mockAnalizarImagenUseCase.execute).toHaveBeenCalledWith({
        buffer: mockFile.buffer,
        nombreArchivo: 'panoramica.png',
        mimeType: 'image/png',
        tamanioBytes: 1024,
      });
    });

    it('debe procesar exitosamente imagen codificada en JSON base64', async () => {
      const base64Data = Buffer.from('fake-jpeg-bytes').toString('base64');
      const body = {
        imagenBase64: base64Data,
        mimeType: 'image/jpeg',
      };

      const result = await controller.analizarImagen(undefined, body);
      expect(result).toEqual(mockAnalisisResult);
      expect(mockAnalizarImagenUseCase.execute).toHaveBeenCalledWith(
        expect.objectContaining({
          nombreArchivo: 'imagen_base64',
          mimeType: 'image/jpeg',
          tamanioBytes: Buffer.from('fake-jpeg-bytes').length,
        }),
      );
    });

    it('debe lanzar BadRequestException si no se adjunta archivo ni JSON base64', async () => {
      await expect(controller.analizarImagen(undefined, {})).rejects.toThrow(BadRequestException);
    });
  });

  describe('POST /api/expediente/estudios/analizar-radiografia (alias)', () => {
    it('debe delegar a analizarImagen como alias retrocompatible', async () => {
      const mockFile: Express.Multer.File = {
        fieldname: 'archivo',
        originalname: 'rx.png',
        encoding: '7bit',
        mimetype: 'image/png',
        buffer: Buffer.from('fake-png-bytes'),
        size: 512,
        stream: null as any,
        destination: '',
        filename: '',
        path: '',
      };

      const result = await controller.analizarRadiografia(mockFile, {});
      expect(result).toEqual(mockAnalisisResult);
      expect(mockAnalizarImagenUseCase.execute).toHaveBeenCalledWith(
        expect.objectContaining({
          nombreArchivo: 'rx.png',
          mimeType: 'image/png',
        }),
      );
    });
  });

  describe('POST /api/expediente/estudios (guardar estudio)', () => {
    it('debe extraer odontologoId estrictamente del JWT e ignorar cualquier valor en el body', async () => {
      const mockReq: Partial<RequestConOperador> = {
        odontologoActual: {
          odontologoId: 'od_jwt_verified',
          sub: 'auth0|123',
          roles: ['ODONTOLOGO'],
          email: 'dr@dental.com',
          nombre: 'Dr. Odontólogo',
        },
      };

      const body = {
        pacienteId: 'pac_456',
        consultaId: 'cons_789',
        odontologoId: 'HACKER_ATTEMPTED_ID', // Must be ignored
        analisisIa: mockAnalisisResult,
        observacionMedico: 'Caries visible en pieza 16',
      };

      const result = await controller.guardarEstudio(body as any, mockReq as RequestConOperador);

      expect(result).toEqual(mockEstudioDto);
      expect(mockGuardarEstudioUseCase.execute).toHaveBeenCalledWith(
        expect.objectContaining({
          pacienteId: 'pac_456',
          consultaId: 'cons_789',
          odontologoId: 'od_jwt_verified', // From JWT!
        }),
      );
      expect(mockGuardarEstudioUseCase.execute).not.toHaveBeenCalledWith(
        expect.objectContaining({
          odontologoId: 'HACKER_ATTEMPTED_ID',
        }),
      );
    });

    it('debe lanzar BadRequestException si el JWT no provee odontologoId', async () => {
      const mockReq: Partial<RequestConOperador> = {
        odontologoActual: undefined,
      };

      await expect(
        controller.guardarEstudio(
          {
            pacienteId: 'pac_456',
            consultaId: 'cons_789',
            analisisIa: mockAnalisisResult,
          } as any,
          mockReq as RequestConOperador,
        ),
      ).rejects.toThrow(BadRequestException);
    });
  });

  describe('GET /api/expediente/estudios/paciente/:pacienteId', () => {
    it('debe listar estudios clínicos del paciente', async () => {
      const result = await controller.listarPorPaciente('pac_456');
      expect(result).toEqual([mockEstudioDto]);
      expect(mockListarEstudiosUseCase.execute).toHaveBeenCalledWith('pac_456');
    });
  });
});
