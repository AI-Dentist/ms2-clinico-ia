import {
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  Patch,
  Post,
  Req,
  UseGuards,
} from '@nestjs/common';
import {
  CrearSolicitudEstudioUseCase,
  ListarSolicitudesPorConsultaUseCase,
  ListarSolicitudesPorHistoriaUseCase,
  ObtenerSolicitudEstudioPorIdUseCase,
  CambiarEstadoSolicitudUseCase,
  RegistrarResultadoEstudioUseCase,
} from '../../../application/use-cases/solicitudes-estudio.use-cases.js';
import {
  CrearSolicitudEstudioHttpDto,
  CambiarEstadoSolicitudHttpDto,
} from '../dtos/solicitud-estudio.http-dto.js';
import { RegistrarResultadoEstudioHttpDto } from '../dtos/resultado-estudio.http-dto.js';
import { OdontologoAuthGuard, type RequestConOperador } from '../guards/odontologo-auth.guard.js';
import type { SolicitudEstudioDto } from '../../../application/dtos/estudios.dtos.js';

@Controller('estudios')
@UseGuards(OdontologoAuthGuard)
export class EstudiosController {
  constructor(
    private readonly crearSolicitudUseCase: CrearSolicitudEstudioUseCase,
    private readonly listarPorConsultaUseCase: ListarSolicitudesPorConsultaUseCase,
    private readonly listarPorHistoriaUseCase: ListarSolicitudesPorHistoriaUseCase,
    private readonly obtenerPorIdUseCase: ObtenerSolicitudEstudioPorIdUseCase,
    private readonly cambiarEstadoUseCase: CambiarEstadoSolicitudUseCase,
    private readonly registrarResultadoUseCase: RegistrarResultadoEstudioUseCase
  ) {}

  @Post('solicitudes')
  @HttpCode(HttpStatus.CREATED)
  async crearSolicitud(
    @Body() dto: CrearSolicitudEstudioHttpDto,
    @Req() req: RequestConOperador
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
  async obtenerSolicitudPorId(@Param('id') id: string): Promise<SolicitudEstudioDto> {
    return this.obtenerPorIdUseCase.execute(id);
  }

  @Get('solicitudes/consulta/:consultaId')
  async listarPorConsulta(@Param('consultaId') consultaId: string): Promise<SolicitudEstudioDto[]> {
    return this.listarPorConsultaUseCase.execute(consultaId);
  }

  @Get('solicitudes/historia/:historiaClinicaId')
  async listarPorHistoriaClinica(
    @Param('historiaClinicaId') historiaClinicaId: string
  ): Promise<SolicitudEstudioDto[]> {
    return this.listarPorHistoriaUseCase.execute(historiaClinicaId);
  }

  @Patch('solicitudes/:id/estado')
  async cambiarEstado(
    @Param('id') id: string,
    @Body() dto: CambiarEstadoSolicitudHttpDto
  ): Promise<SolicitudEstudioDto> {
    return this.cambiarEstadoUseCase.execute(id, dto.estado, dto.motivoCancelacion);
  }

  @Post('solicitudes/:id/resultado')
  @HttpCode(HttpStatus.CREATED)
  async registrarResultado(
    @Param('id') id: string,
    @Body() dto: RegistrarResultadoEstudioHttpDto,
    @Req() req: RequestConOperador
  ): Promise<SolicitudEstudioDto> {
    return this.registrarResultadoUseCase.execute({
      solicitudId: id,
      laboratorioId: dto.laboratorioId,
      fechaResultado: dto.fechaResultado,
      resumen: dto.resumen,
      observaciones: dto.observaciones,
      valoresReferencia: dto.valoresReferencia,
      tokenOdontologo: req.operadorToken || '',
    });
  }
}
