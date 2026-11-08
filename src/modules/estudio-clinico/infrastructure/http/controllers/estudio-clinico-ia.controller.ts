import {
  BadRequestException,
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  Post,
  Req,
  UploadedFile,
  UseGuards,
  UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import {
  ApiBearerAuth,
  ApiBody,
  ApiConsumes,
  ApiOperation,
  ApiResponse,
  ApiTags,
} from '@nestjs/swagger';
import { IsNotEmpty, IsOptional, IsString } from 'class-validator';
import { AnalizarImagenIaUseCase } from '../../../../ia-diagnostico/application/use-cases/analizar-imagen-ia.use-case.js';
import { GuardarEstudioClinicoUseCase } from '../../../application/use-cases/guardar-estudio-clinico.use-case.js';
import { ListarEstudiosPorPacienteUseCase } from '../../../application/use-cases/listar-estudios-por-paciente.use-case.js';
import type { AnalisisImagenIaDto } from '../../../../ia-diagnostico/application/dtos/analisis-imagen-ia.dto.js';
import type { EstudioClinicoDto } from '../../../application/dtos/estudio-clinico.dto.js';
import { OdontologoAuthGuard } from '../../../../estudios/infrastructure/http/guards/odontologo-auth.guard.js';
import type { RequestConOperador } from '../../../../estudios/infrastructure/http/guards/odontologo-auth.guard.js';
import { RolesGuard } from '../../../../../infrastructure/auth/roles.guard.js';
import { Roles } from '../../../../../infrastructure/auth/roles.decorator.js';

export class AnalizarImagenBodyDto {
  @IsOptional()
  @IsString()
  imagenBase64?: string;

  @IsOptional()
  @IsString()
  mimeType?: string;
}

export class CrearEstudioClinicoBodyDto {
  @IsString()
  @IsNotEmpty()
  pacienteId: string;

  @IsString()
  @IsNotEmpty()
  consultaId: string;

  @IsOptional()
  @IsString()
  odontologoId?: string;

  @IsNotEmpty()
  analisisIa: any;

  @IsOptional()
  @IsString()
  imagenBase64?: string;

  @IsOptional()
  @IsString()
  imagenMimeType?: string;

  @IsOptional()
  @IsString()
  imagenNombreArchivo?: string;

  @IsOptional()
  @IsString()
  observacionMedico?: string;
}

@ApiTags('Estudios Clínicos — IA Dental (YOLO11 ONNX)')
@ApiBearerAuth('JWT')
@Controller('estudios')
@UseGuards(OdontologoAuthGuard, RolesGuard)
export class EstudioClinicoIaController {
  constructor(
    private readonly analizarImagenUseCase: AnalizarImagenIaUseCase,
    private readonly guardarEstudioUseCase: GuardarEstudioClinicoUseCase,
    private readonly listarEstudiosUseCase: ListarEstudiosPorPacienteUseCase,
  ) {}

  /**
   * POST /api/expediente/estudios/analizar-imagen
   * Accepts multipart `archivo` (JPEG/PNG/WebP) or JSON `{imagenBase64, mimeType}`.
   * Returns S8 hallazgos[] with YOLO11 ONNX inference.
   */
  @Post('analizar-imagen')
  @Roles('ODONTOLOGO', 'ADMIN')
  @HttpCode(HttpStatus.OK)
  @UseInterceptors(FileInterceptor('archivo'))
  @ApiOperation({
    summary: 'Analizar imagen dental con YOLO11 ONNX (liodon-ai/dental-panoramic-detector)',
    description:
      'Acepta una imagen radiográfica (JPEG/PNG/WebP) como multipart "archivo" o como imagenBase64 en el cuerpo JSON. ' +
      'Retorna hallazgos[] con etiqueta, probabilidad, severidad, zona, boundingBox y recomendación clínica. ' +
      'Modelo CC-BY-NC-4.0 — solo uso no comercial.',
  })
  @ApiConsumes('multipart/form-data', 'application/json')
  @ApiBody({
    schema: {
      oneOf: [
        {
          type: 'object',
          properties: {
            archivo: { type: 'string', format: 'binary', description: 'Imagen dental (JPEG, PNG o WebP)' },
          },
        },
        {
          type: 'object',
          properties: {
            imagenBase64: { type: 'string', description: 'Imagen codificada en Base64' },
            mimeType: { type: 'string', enum: ['image/jpeg', 'image/png', 'image/webp'] },
          },
          required: ['imagenBase64', 'mimeType'],
        },
      ],
    },
  })
  @ApiResponse({ status: 200, description: 'Inferencia calculada exitosamente.' })
  @ApiResponse({ status: 400, description: 'Imagen ausente, corrupta o formato no soportado.' })
  @ApiResponse({ status: 503, description: 'Modelo ONNX no disponible (MODELO_NO_DISPONIBLE).' })
  async analizarImagen(
    @UploadedFile() file: Express.Multer.File | undefined,
    @Body() body: AnalizarImagenBodyDto,
  ): Promise<AnalisisImagenIaDto> {
    // Multipart file takes priority
    if (file && file.buffer && file.buffer.length > 0) {
      return this.analizarImagenUseCase.execute({
        buffer: file.buffer,
        nombreArchivo: file.originalname || 'imagen.bin',
        mimeType: file.mimetype || 'application/octet-stream',
        tamanioBytes: file.size ?? file.buffer.length,
      });
    }

    // JSON base64 path
    if (body?.imagenBase64 && body.mimeType) {
      let buffer: Buffer;
      try {
        buffer = Buffer.from(body.imagenBase64, 'base64');
      } catch {
        throw new BadRequestException('imagenBase64 no es un string Base64 válido.');
      }
      if (buffer.length === 0) {
        throw new BadRequestException('imagenBase64 está vacío después de decodificar.');
      }
      return this.analizarImagenUseCase.execute({
        buffer,
        nombreArchivo: 'imagen_base64',
        mimeType: body.mimeType,
        tamanioBytes: buffer.length,
      });
    }

    throw new BadRequestException(
      'Debe adjuntar una imagen como multipart "archivo" o proporcionar ' +
        '"imagenBase64" y "mimeType" en el cuerpo JSON.',
    );
  }

  /**
   * POST /api/expediente/estudios/analizar-radiografia
   * Backward-compatible alias for analizar-imagen.
   */
  @Post('analizar-radiografia')
  @Roles('ODONTOLOGO', 'ADMIN')
  @HttpCode(HttpStatus.OK)
  @UseInterceptors(FileInterceptor('archivo'))
  @ApiOperation({
    summary: 'Analizar radiografía dental (alias retrocompatible hacia YOLO11 ONNX)',
    description:
      'Alias retrocompatible de analizar-imagen. Acepta multipart "archivo" o JSON { imagenBase64, mimeType }.',
  })
  @ApiConsumes('multipart/form-data', 'application/json')
  @ApiResponse({ status: 200, description: 'Inferencia calculada exitosamente.' })
  @ApiResponse({ status: 400, description: 'Imagen ausente, corrupta o formato no soportado.' })
  @ApiResponse({ status: 503, description: 'Modelo ONNX no disponible (MODELO_NO_DISPONIBLE).' })
  async analizarRadiografia(
    @UploadedFile() file: Express.Multer.File | undefined,
    @Body() body: AnalizarImagenBodyDto,
  ): Promise<AnalisisImagenIaDto> {
    return this.analizarImagen(file, body);
  }

  /**
   * POST /api/expediente/estudios
   * Saves an EstudioClinico document to MongoDB.
   * odontologoId is extracted exclusively from the JWT (never from body).
   */
  @Post()
  @Roles('ODONTOLOGO', 'ADMIN')
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({
    summary: 'Guardar estudio clínico con resultado de IA',
    description:
      'Persiste un EstudioClinico en MongoDB. ' +
      'El odontologoId se extrae siempre del JWT — cualquier valor en el body es ignorado. ' +
      'imagenBase64 se almacena (hasta 25 MB) pero se excluye de las consultas de historial.',
  })
  @ApiResponse({ status: 201, description: 'Estudio clínico guardado.' })
  @ApiResponse({ status: 400, description: 'Datos inválidos o imagen excede 25 MB.' })
  async guardarEstudio(
    @Body() body: CrearEstudioClinicoBodyDto,
    @Req() req: RequestConOperador,
  ): Promise<EstudioClinicoDto> {
    const odontologoId = req.odontologoActual?.odontologoId;
    if (!odontologoId) {
      throw new BadRequestException('No se pudo obtener el odontologoId del JWT.');
    }

    return this.guardarEstudioUseCase.execute({
      pacienteId: body.pacienteId,
      consultaId: body.consultaId,
      odontologoId, // strictly from JWT
      analisisIa: {
        ...body.analisisIa,
        observacionMedico: body.observacionMedico ?? body.analisisIa?.observacionMedico ?? null,
      },
      imagenBase64: body.imagenBase64 ?? null,
      imagenMimeType: body.imagenMimeType ?? null,
      imagenNombreArchivo: body.imagenNombreArchivo ?? null,
    });
  }

  /**
   * GET /api/expediente/estudios/paciente/:pacienteId
   * Returns clinical study history for a patient.
   * imagenBase64 is excluded from each result (see MongoEstudioClinicoRepository).
   */
  @Get('paciente/:pacienteId')
  @Roles('ODONTOLOGO', 'ADMIN')
  @ApiOperation({
    summary: 'Historial de estudios clínicos por paciente',
    description:
      'Lista todos los estudios clínicos del paciente, ordenados por fecha descendente. ' +
      'El campo imagenBase64 se omite de cada resultado para mantener respuestas ligeras.',
  })
  @ApiResponse({ status: 200, description: 'Lista de estudios clínicos sin imagenBase64.' })
  async listarPorPaciente(@Param('pacienteId') pacienteId: string): Promise<EstudioClinicoDto[]> {
    return this.listarEstudiosUseCase.execute(pacienteId);
  }
}
