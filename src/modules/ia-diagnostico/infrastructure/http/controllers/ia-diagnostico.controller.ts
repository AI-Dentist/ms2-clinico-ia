import {
  BadRequestException,
  Controller,
  HttpCode,
  HttpStatus,
  Post,
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
import { OdontologoAuthGuard } from '../../../../historias-clinicas/infrastructure/http/guards/odontologo-auth.guard.js';
import { RolesGuard } from '../../../../../infrastructure/auth/roles.guard.js';
import { Roles } from '../../../../../infrastructure/auth/roles.decorator.js';
import { AnalizarRadiografiaUseCase } from '../../../application/use-cases/analizar-radiografia.use-case.js';
import type { AnalisisRadiografiaDto } from '../../../application/dtos/analisis-radiografia.dto.js';

@ApiTags('Inteligencia Artificial y Diagnóstico')
@ApiBearerAuth('JWT')
@Controller('ia')
@UseGuards(OdontologoAuthGuard, RolesGuard)
export class IaDiagnosticoController {
  constructor(private readonly analizarRadiografiaUseCase: AnalizarRadiografiaUseCase) {}

  @Post('analizar-radiografia')
  @Roles('ODONTOLOGO', 'ADMIN')
  @HttpCode(HttpStatus.OK)
  @UseInterceptors(FileInterceptor('archivo'))
  @ApiOperation({
    summary: 'Análisis de radiografía dental mediante Red Neuronal Convolucional (CNN)',
    description:
      'Recibe una radiografía periapical, panorámica o fotografía intraoral en formato binario (multipart/form-data) y ejecuta inferencia profunda para detectar caries y lesiones.',
  })
  @ApiConsumes('multipart/form-data')
  @ApiBody({
    schema: {
      type: 'object',
      properties: {
        archivo: {
          type: 'string',
          format: 'binary',
          description: 'Archivo de imagen dental (JPEG, PNG o DICOM)',
        },
      },
      required: ['archivo'],
    },
  })
  @ApiResponse({
    status: 200,
    description: 'Inferencia calculada exitosamente por la red neuronal profunda.',
  })
  @ApiResponse({ status: 400, description: 'Archivo ausente, corrupto o formato no soportado.' })
  @ApiResponse({ status: 401, description: 'No autorizado / Token ausente o inválido.' })
  @ApiResponse({ status: 403, description: 'Acceso denegado: se requiere rol ODONTOLOGO o ADMIN.' })
  async analizarRadiografia(
    @UploadedFile() file?: Express.Multer.File,
  ): Promise<AnalisisRadiografiaDto> {
    if (!file || !file.buffer || file.buffer.length === 0) {
      throw new BadRequestException(
        'Debe adjuntar un archivo de imagen radiográfica en el campo multipart "archivo".',
      );
    }

    return this.analizarRadiografiaUseCase.execute({
      buffer: file.buffer,
      nombreArchivo: file.originalname || 'radiografia.png',
      mimeType: file.mimetype || 'image/png',
      tamanioBytes: file.size ?? file.buffer.length,
    });
  }
}
