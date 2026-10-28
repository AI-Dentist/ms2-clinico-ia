import {
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  Post,
  Put,
  Query,
  UseGuards,
} from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiOperation,
  ApiParam,
  ApiQuery,
  ApiResponse,
  ApiTags,
} from '@nestjs/swagger';
import { OdontologoAuthGuard } from '../guards/odontologo-auth.guard.js';
import { OperadorToken } from '../decorators/operador-token.decorator.js';
import {
  AbrirConsultaHttpDto,
  ActualizarAtencionHttpDto,
  CompletarConsultaHttpDto,
  CancelarConsultaHttpDto,
  ListarConsultasQueryHttpDto,
} from '../dtos/index.js';

// Casos de uso de la capa Application
import {
  RegistrarAperturaConsultaUseCase,
  ObtenerConsultaPorIdUseCase,
  ListarConsultasPorHistoriaUseCase,
  ActualizarAtencionConsultaUseCase,
  CompletarConsultaUseCase,
  CancelarConsultaUseCase,
  ConsultarCatalogoServiciosUseCase,
  type ConsultaOdontologicaResponseDto,
  type ListadoConsultasResponseDto,
  type ServicioCatalogoDto,
} from '../../../application/index.js';

@ApiTags('Consultas Odontológicas')
@ApiBearerAuth('bearer')
@Controller('consultas-odontologicas')
@UseGuards(OdontologoAuthGuard)
export class ConsultasOdontologicasController {
  constructor(
    private readonly registrarAperturaConsultaUseCase: RegistrarAperturaConsultaUseCase,
    private readonly obtenerConsultaPorIdUseCase: ObtenerConsultaPorIdUseCase,
    private readonly listarConsultasPorHistoriaUseCase: ListarConsultasPorHistoriaUseCase,
    private readonly actualizarAtencionConsultaUseCase: ActualizarAtencionConsultaUseCase,
    private readonly completarConsultaUseCase: CompletarConsultaUseCase,
    private readonly cancelarConsultaUseCase: CancelarConsultaUseCase,
    private readonly consultarCatalogoServiciosUseCase: ConsultarCatalogoServiciosUseCase,
  ) {}

  @Post()
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({
    summary: 'Registrar la apertura de una nueva consulta odontológica',
    description:
      'Inicia un nuevo encuentro clínico en estado EN_CURSO congelando el Snapshot de riesgo clínico inmutable del paciente.',
  })
  @ApiResponse({
    status: 201,
    description: 'Consulta abierta y registrada exitosamente.',
  })
  @ApiResponse({ status: 400, description: 'Cuerpo de solicitud inválido o propiedades no permitidas.' })
  @ApiResponse({ status: 401, description: 'No autenticado o token de operador no autorizado.' })
  @ApiResponse({ status: 409, description: 'La cita especificada ya se encuentra asociada a otra consulta.' })
  @ApiResponse({
    status: 422,
    description: 'Historia clínica no activa, paciente no coincide, cita no válida o datos clínicos no procesables.',
  })
  async abrirConsulta(
    @Body() dto: AbrirConsultaHttpDto,
    @OperadorToken() token: string,
  ): Promise<ConsultaOdontologicaResponseDto> {
    return this.registrarAperturaConsultaUseCase.execute({
      tokenAutenticacion: token,
      historiaClinicaId: dto.historiaClinicaId,
      pacienteId: dto.pacienteId,
      citaId: dto.citaId,
      motivoConsulta: dto.motivoConsulta,
      anamnesisActual: dto.anamnesisActual,
      exploracionFisica: dto.exploracionFisica,
      diagnosticos: dto.diagnosticos,
      procedimientosRealizados: dto.procedimientosRealizados,
      evolucionSOAP: dto.evolucionSOAP,
      recomendaciones: dto.recomendaciones,
      fechaAtencion: dto.fechaAtencion ? new Date(dto.fechaAtencion) : undefined,
    });
  }

  // Ruta estática declarada ANTES de :id para evitar colisiones de rutas en Express
  @Get('historia/:historiaClinicaId')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Listar consultas asociadas a una historia clínica',
    description:
      'Recupera el historial cronológico descendente de consultas de una historia clínica con paginación estable.',
  })
  @ApiParam({
    name: 'historiaClinicaId',
    description: 'Identificador canónico de la historia clínica',
    example: 'hc_12345678-aaaa-bbbb',
  })
  @ApiResponse({ status: 200, description: 'Lista paginada de consultas odontológicas.' })
  @ApiResponse({ status: 401, description: 'No autenticado o token no autorizado.' })
  async listarPorHistoriaClinica(
    @Param('historiaClinicaId') historiaClinicaId: string,
    @Query() query: ListarConsultasQueryHttpDto,
    @OperadorToken() token: string,
  ): Promise<ListadoConsultasResponseDto> {
    return this.listarConsultasPorHistoriaUseCase.execute({
      tokenAutenticacion: token,
      historiaClinicaId,
      limite: query.limite,
      offset: query.offset,
    });
  }

  @Get('catalogo-servicios')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Listar servicios odontológicos activos del catálogo de MS1',
    description:
      'Consulta los servicios odontológicos activos disponibles en el ERP (MS1), con filtro opcional por especialidad. Preserva la precisión monetaria de precioBaseBs como string decimal.',
  })
  @ApiQuery({
    name: 'especialidadId',
    required: false,
    description: 'UUID de la especialidad para filtrar servicios',
    example: '60000000-0000-0000-0000-000000000010',
  })
  @ApiResponse({ status: 200, description: 'Listado de servicios odontológicos activos.' })
  @ApiResponse({ status: 401, description: 'No autenticado o credenciales inválidas.' })
  @ApiResponse({ status: 502, description: 'Error de comunicación o GraphQL con MS1.' })
  @ApiResponse({ status: 503, description: 'Catálogo de MS1 no disponible (timeout/red).' })
  async listarCatalogoServicios(
    @Query('especialidadId') especialidadId?: string,
  ): Promise<ServicioCatalogoDto[]> {
    return this.consultarCatalogoServiciosUseCase.listar(especialidadId);
  }

  @Get('catalogo-servicios/:servicioId')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Obtener un servicio odontológico por su ID desde el catálogo de MS1',
    description:
      'Recupera el detalle de un servicio odontológico a partir de su UUID canónico en MS1.',
  })
  @ApiParam({
    name: 'servicioId',
    description: 'UUID canónico del servicio en MS1',
    example: '550e8400-e29b-41d4-a716-446655440001',
  })
  @ApiResponse({ status: 200, description: 'Detalle del servicio odontológico.' })
  @ApiResponse({ status: 401, description: 'No autenticado.' })
  @ApiResponse({ status: 404, description: 'Servicio no encontrado en el catálogo de MS1.' })
  @ApiResponse({ status: 422, description: 'Formato de ID de servicio inválido (no es UUID RFC 4122).' })
  @ApiResponse({ status: 502, description: 'Error de comunicación o GraphQL con MS1.' })
  @ApiResponse({ status: 503, description: 'Catálogo de MS1 no disponible.' })
  async obtenerServicioCatalogoPorId(
    @Param('servicioId') servicioId: string,
  ): Promise<ServicioCatalogoDto> {
    return this.consultarCatalogoServiciosUseCase.obtenerPorId(servicioId);
  }

  @Get(':id')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Obtener el detalle de una consulta odontológica por ID',
    description:
      'Recupera la ficha completa de una consulta clínica incluyendo diagnósticos, procedimientos, evolución y auditoría.',
  })
  @ApiParam({
    name: 'id',
    description: 'Identificador canónico de la consulta (cons_<uuid>)',
    example: 'cons_12345678-1111-2222-3333-444455556666',
  })
  @ApiResponse({ status: 200, description: 'Detalle de la consulta odontológica.' })
  @ApiResponse({ status: 401, description: 'No autenticado.' })
  @ApiResponse({ status: 404, description: 'Consulta odontológica no encontrada.' })
  async obtenerPorId(
    @Param('id') id: string,
    @OperadorToken() token: string,
  ): Promise<ConsultaOdontologicaResponseDto> {
    return this.obtenerConsultaPorIdUseCase.execute({
      tokenAutenticacion: token,
      consultaId: id,
    });
  }

  @Put(':id/atencion')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Actualizar datos clínicos de la atención en sillón',
    description:
      'Permite modificar en bloque la anamnesis, exploración, diagnósticos, procedimientos y evolución de una consulta EN_CURSO.',
  })
  @ApiParam({
    name: 'id',
    description: 'Identificador canónico de la consulta',
    example: 'cons_12345678-1111-2222-3333-444455556666',
  })
  @ApiResponse({ status: 200, description: 'Consulta odontológica actualizada exitosamente.' })
  @ApiResponse({ status: 400, description: 'Cuerpo de solicitud inválido o propiedades no permitidas.' })
  @ApiResponse({ status: 401, description: 'No autenticado.' })
  @ApiResponse({ status: 404, description: 'Consulta no encontrada.' })
  @ApiResponse({ status: 409, description: 'Conflicto de concurrencia optimista (versión esperada obsoleta).' })
  @ApiResponse({ status: 422, description: 'Consulta cerrada/cancelada o datos clínicos no válidos.' })
  async actualizarAtencion(
    @Param('id') id: string,
    @Body() dto: ActualizarAtencionHttpDto,
    @OperadorToken() token: string,
  ): Promise<ConsultaOdontologicaResponseDto> {
    return this.actualizarAtencionConsultaUseCase.execute({
      tokenAutenticacion: token,
      consultaId: id,
      versionEsperada: dto.versionEsperada,
      motivoConsulta: dto.motivoConsulta,
      anamnesisActual: dto.anamnesisActual,
      exploracionFisica: dto.exploracionFisica,
      diagnosticos: dto.diagnosticos,
      procedimientosRealizados: dto.procedimientosRealizados,
      evolucionSOAP: dto.evolucionSOAP,
      recomendaciones: dto.recomendaciones,
    });
  }

  @Post(':id/completar')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Completar y sellar formalmente la consulta odontológica',
    description:
      'Realiza el cierre formal del encuentro clínico pasando a estado COMPLETADA de forma irrevocable. Requiere haber documentado la exploración intraoral y al menos un diagnóstico.',
  })
  @ApiParam({
    name: 'id',
    description: 'Identificador canónico de la consulta',
    example: 'cons_12345678-1111-2222-3333-444455556666',
  })
  @ApiResponse({ status: 200, description: 'Consulta completada y sellada exitosamente.' })
  @ApiResponse({ status: 400, description: 'Cuerpo inválido.' })
  @ApiResponse({ status: 401, description: 'No autenticado.' })
  @ApiResponse({ status: 404, description: 'Consulta no encontrada.' })
  @ApiResponse({ status: 409, description: 'Conflicto de concurrencia optimista.' })
  @ApiResponse({ status: 422, description: 'Requisitos clínicos de cierre incumplidos o estado no editable.' })
  async completarConsulta(
    @Param('id') id: string,
    @Body() dto: CompletarConsultaHttpDto,
    @OperadorToken() token: string,
  ): Promise<ConsultaOdontologicaResponseDto> {
    return this.completarConsultaUseCase.execute({
      tokenAutenticacion: token,
      consultaId: id,
      versionEsperada: dto.versionEsperada,
      serviciosFacturables: dto.serviciosFacturables?.map((s) => ({
        servicioId: s.servicioId,
        cantidad: s.cantidad,
        piezaDental: s.piezaDental,
      })),
      observacionesCobro: dto.observacionesCobro,
    });
  }

  @Post(':id/cancelar')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Cancelar una consulta odontológica en curso',
    description:
      'Cancela una consulta en estado EN_CURSO requiriendo una justificación clínica o administrativa obligatoria.',
  })
  @ApiParam({
    name: 'id',
    description: 'Identificador canónico de la consulta',
    example: 'cons_12345678-1111-2222-3333-444455556666',
  })
  @ApiResponse({ status: 200, description: 'Consulta cancelada exitosamente.' })
  @ApiResponse({ status: 400, description: 'Cuerpo inválido o justificación ausente.' })
  @ApiResponse({ status: 401, description: 'No autenticado.' })
  @ApiResponse({ status: 404, description: 'Consulta no encontrada.' })
  @ApiResponse({ status: 409, description: 'Conflicto de concurrencia optimista.' })
  @ApiResponse({ status: 422, description: 'Consulta ya cerrada o cancelada previamente.' })
  async cancelarConsulta(
    @Param('id') id: string,
    @Body() dto: CancelarConsultaHttpDto,
    @OperadorToken() token: string,
  ): Promise<ConsultaOdontologicaResponseDto> {
    return this.cancelarConsultaUseCase.execute({
      tokenAutenticacion: token,
      consultaId: id,
      versionEsperada: dto.versionEsperada,
      motivoCancelacion: dto.motivoCancelacion,
    });
  }
}
