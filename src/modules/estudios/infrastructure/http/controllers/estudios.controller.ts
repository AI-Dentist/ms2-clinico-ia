import {
  BadRequestException,
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  Patch,
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
import {
  CrearSolicitudEstudioUseCase,
  ListarSolicitudesPorConsultaUseCase,
  ListarSolicitudesPorHistoriaUseCase,
  ObtenerSolicitudEstudioPorIdUseCase,
  CambiarEstadoSolicitudUseCase,
  RegistrarResultadoEstudioUseCase,
  AdjuntarArchivoEstudioUseCase,
} from '../../../application/use-cases/solicitudes-estudio.use-cases.js';

import {
  CrearSolicitudEstudioHttpDto,
  CambiarEstadoSolicitudHttpDto,
} from '../dtos/solicitud-estudio.http-dto.js';
import { RegistrarResultadoEstudioHttpDto } from '../dtos/resultado-estudio.http-dto.js';
import { OdontologoAuthGuard, type RequestConOperador } from '../guards/odontologo-auth.guard.js';
import { RolesGuard } from '../../../../../infrastructure/auth/roles.guard.js';
import { Roles } from '../../../../../infrastructure/auth/roles.decorator.js';
import type { SolicitudEstudioDto } from '../../../application/dtos/estudios.dtos.js';

@ApiTags('Estudios Clínicos y Radiología')
@ApiBearerAuth('JWT')
@Controller('estudios')
@UseGuards(OdontologoAuthGuard, RolesGuard)
export class EstudiosController {
  constructor(
    private readonly crearSolicitudUseCase: CrearSolicitudEstudioUseCase,
    private readonly listarPorConsultaUseCase: ListarSolicitudesPorConsultaUseCase,
    private readonly listarPorHistoriaUseCase: ListarSolicitudesPorHistoriaUseCase,
    private readonly obtenerPorIdUseCase: ObtenerSolicitudEstudioPorIdUseCase,
    private readonly cambiarEstadoUseCase: CambiarEstadoSolicitudUseCase,
    private readonly registrarResultadoUseCase: RegistrarResultadoEstudioUseCase,
    private readonly adjuntarArchivoUseCase: AdjuntarArchivoEstudioUseCase,
  ) {}

  @Post('solicitudes')
  @Roles('ODONTOLOGO', 'ADMIN')
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({ summary: 'Crear solicitud de estudio clínico o radiografía' })
  @ApiResponse({ status: 201, description: 'Solicitud de estudio creada' })
  @ApiResponse({ status: 401, description: 'No autenticado' })
  @ApiResponse({ status: 403, description: 'Acceso denegado: rol insuficiente' })
  async crearSolicitud(
    @Body() dto: CrearSolicitudEstudioHttpDto,
    @Req() req: RequestConOperador,
  ): Promise<SolicitudEstudioDto> {
    return this.crearSolicitudUseCase.execute({
      consultaId: dto.consultaId,
      tipoEstudioId: dto.tipoEstudioId,
      motivo: dto.motivo,
      indicaciones: dto.indicaciones,
      prioridad: dto.prioridad,
      tokenOdontologo: req.operadorToken || '',
    });
  }

  @Get('solicitudes/:id')
  @ApiOperation({ summary: 'Obtener solicitud de estudio por ID' })
  async obtenerSolicitudPorId(@Param('id') id: string): Promise<SolicitudEstudioDto> {
    return this.obtenerPorIdUseCase.execute(id);
  }

  @Get('solicitudes/consulta/:consultaId')
  @ApiOperation({ summary: 'Listar solicitudes de estudio por consulta' })
  async listarPorConsulta(@Param('consultaId') consultaId: string): Promise<SolicitudEstudioDto[]> {
    return this.listarPorConsultaUseCase.execute(consultaId);
  }

  @Get('solicitudes/historia/:historiaClinicaId')
  @ApiOperation({ summary: 'Listar solicitudes de estudio por historia clínica' })
  async listarPorHistoriaClinica(
    @Param('historiaClinicaId') historiaClinicaId: string,
  ): Promise<SolicitudEstudioDto[]> {
    return this.listarPorHistoriaUseCase.execute(historiaClinicaId);
  }

  @Patch('solicitudes/:id/estado')
  @Roles('ODONTOLOGO', 'ADMIN')
  @ApiOperation({ summary: 'Cambiar estado de la solicitud de estudio' })
  @ApiResponse({ status: 200, description: 'Estado de solicitud actualizado' })
  @ApiResponse({ status: 403, description: 'Acceso denegado: rol insuficiente' })
  async cambiarEstado(
    @Param('id') id: string,
    @Body() dto: CambiarEstadoSolicitudHttpDto,
  ): Promise<SolicitudEstudioDto> {
    return this.cambiarEstadoUseCase.execute(id, dto.estado, dto.motivoCancelacion);
  }

  @Post('solicitudes/:id/resultado')
  @Roles('ODONTOLOGO', 'ADMIN')
  @HttpCode(HttpStatus.CREATED)
  @UseInterceptors(FileInterceptor('archivo'))
  @ApiOperation({ summary: 'Registrar resultado clínico de estudio con archivo opcional' })
  @ApiConsumes('application/json', 'multipart/form-data')
  @ApiResponse({ status: 201, description: 'Resultado clínico y archivo registrados' })
  @ApiResponse({ status: 403, description: 'Acceso denegado: rol insuficiente' })
  async registrarResultado(
    @Param('id') id: string,
    @Body() dto: RegistrarResultadoEstudioHttpDto,
    @Req() req: RequestConOperador,
    @UploadedFile() file?: Express.Multer.File,
  ): Promise<SolicitudEstudioDto> {
    let archivoAdjunto = dto.archivoAdjunto;
    if (file && file.buffer) {
      archivoAdjunto = {
        urlArchivo: `/uploads/estudios/${file.originalname}`,
        nombreArchivo: file.originalname,
        mimeType: file.mimetype,
        tamanioBytes: file.size ?? file.buffer.length,
      };
    }

    return this.registrarResultadoUseCase.execute({
      solicitudId: id,
      laboratorioId: dto.laboratorioId,
      fechaResultado: dto.fechaResultado,
      resumen: dto.resumen,
      observaciones: dto.observaciones,
      valoresReferencia: dto.valoresReferencia,
      archivoAdjunto,
      tokenOdontologo: req.operadorToken || '',
    });
  }

  @Post('solicitudes/:id/adjunto')
  @Roles('ODONTOLOGO', 'ADMIN')
  @HttpCode(HttpStatus.OK)
  @UseInterceptors(FileInterceptor('archivo'))
  @ApiOperation({ summary: 'Adjuntar archivo médico o imagen real a una solicitud de estudio' })
  @ApiConsumes('multipart/form-data')
  @ApiBody({
    schema: {
      type: 'object',
      properties: {
        archivo: {
          type: 'string',
          format: 'binary',
          description: 'Archivo médico o imagen (JPEG, PNG, DICOM o PDF)',
        },
      },
      required: ['archivo'],
    },
  })
  @ApiResponse({ status: 200, description: 'Archivo adjuntado exitosamente al resultado' })
  @ApiResponse({ status: 400, description: 'Archivo no proporcionado o inválido' })
  @ApiResponse({ status: 403, description: 'Acceso denegado: rol insuficiente' })
  async adjuntarArchivo(
    @Param('id') id: string,
    @Req() req: RequestConOperador,
    @UploadedFile() file?: Express.Multer.File,
  ): Promise<SolicitudEstudioDto> {
    if (!file || !file.buffer) {
      throw new BadRequestException('Debe adjuntar un archivo válido en el campo "archivo".');
    }

    return this.adjuntarArchivoUseCase.execute({
      solicitudId: id,
      archivoAdjunto: {
        urlArchivo: `/uploads/estudios/${file.originalname}`,
        nombreArchivo: file.originalname,
        mimeType: file.mimetype,
        tamanioBytes: file.size ?? file.buffer.length,
      },
      tokenOdontologo: req.operadorToken || '',
    });
  }
}
