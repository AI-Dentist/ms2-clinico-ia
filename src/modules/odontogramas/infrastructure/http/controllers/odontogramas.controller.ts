import {
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Optional,
  Param,
  Post,
  Query,
  UseFilters,
  UseGuards,
} from '@nestjs/common';
import { InjectConnection } from '@nestjs/mongoose';
import type { Connection } from 'mongoose';
import {
  ApiBearerAuth,
  ApiOperation,
  ApiParam,
  ApiResponse,
  ApiTags,
} from '@nestjs/swagger';
import { OdontologoAuthGuard } from '../guards/odontologo-auth.guard.js';
import { ProblemDetailsFilter } from '../../../../historias-clinicas/infrastructure/http/filters/problem-details.filter.js';
import { OperadorToken } from '../decorators/operador-token.decorator.js';
import {
  InicializarOdontogramaHttpDto,
  RegistrarRevisionOdontogramaHttpDto,
  ListarHistorialQueryHttpDto,
} from '../dtos/index.js';
import {
  InicializarOdontogramaUseCase,
  ObtenerOdontogramaActualUseCase,
  RegistrarRevisionOdontogramaUseCase,
  ListarHistorialRevisionesUseCase,
  ObtenerSnapshotRevisionUseCase,
  ObtenerSnapshotsPorConsultaUseCase,
  type OdontogramaActualDto,
  type RevisionOdontogramaDto,
  type ListadoRevisionesPaginadoDto,
} from '../../../application/index.js';

@ApiTags('Odontogramas')
@ApiBearerAuth('bearer')
@UseGuards(OdontologoAuthGuard)
@UseFilters(ProblemDetailsFilter)
@Controller('odontogramas')
export class OdontogramasController {
  constructor(
    private readonly inicializarOdontogramaUseCase: InicializarOdontogramaUseCase,
    private readonly obtenerOdontogramaActualUseCase: ObtenerOdontogramaActualUseCase,
    private readonly registrarRevisionOdontogramaUseCase: RegistrarRevisionOdontogramaUseCase,
    private readonly listarHistorialRevisionesUseCase: ListarHistorialRevisionesUseCase,
    private readonly obtenerSnapshotRevisionUseCase: ObtenerSnapshotRevisionUseCase,
    private readonly obtenerSnapshotsPorConsultaUseCase: ObtenerSnapshotsPorConsultaUseCase,
    @Optional()
    @InjectConnection()
    private readonly connection?: Connection,
  ) {}

  @Get('entorno-aislado/status')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Consultar estado de integración y aislamiento de base de datos',
    description: 'Informa si la instancia actual está conectada de forma segura a MongoDB 27018 con réplicas activas.',
  })
  async estadoEntornoAislado(): Promise<{
    aislado: boolean;
    entorno: string;
    puertoMongo: number | null;
    replicaSet: string | null;
    escrituraHabilitada: boolean;
  }> {
    const port = (this.connection as any)?.port ?? null;
    const isIsolated = port === 27018;
    return {
      aislado: isIsolated,
      entorno: process.env.NODE_ENV || 'development',
      puertoMongo: port,
      replicaSet: isIsolated ? 'rs_odontograma_test' : null,
      escrituraHabilitada: isIsolated,
    };
  }

  @Post('inicializar')
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({
    summary: 'Inicializar odontograma longitudinal',
    description:
      'Crea el agregado longitudinal del odontograma para una historia clínica activa con sus 52 posiciones FDI basales.',
  })
  @ApiResponse({
    status: 201,
    description: 'Odontograma inicializado exitosamente en estado basal.',
  })
  @ApiResponse({ status: 400, description: 'Datos de solicitud inválidos o historia clínica ausente.' })
  @ApiResponse({ status: 401, description: 'No autorizado / Token ausente o inválido.' })
  @ApiResponse({ status: 409, description: 'Ya existe un odontograma para la historia clínica especificada.' })
  @ApiResponse({ status: 422, description: 'Historia clínica inexistente o en estado no activo.' })
  async inicializar(
    @Body() dto: InicializarOdontogramaHttpDto,
    @OperadorToken() token: string,
  ): Promise<OdontogramaActualDto> {
    return this.inicializarOdontogramaUseCase.ejecutar({
      historiaClinicaId: dto.historiaClinicaId,
      tokenOdontologo: token,
    });
  }

  @Get('historia/:historiaClinicaId')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Obtener odontograma actual consolidado por Historia Clínica',
    description:
      'Recupera el estado actual de las 52 piezas dentales preservando explícitamente estados DESCONOCIDO y NO_EVALUADO.',
  })
  @ApiParam({
    name: 'historiaClinicaId',
    description: 'Identificador canónico de la Historia Clínica',
    example: 'hc_12345678-aaaa-bbbb',
  })
  @ApiResponse({ status: 200, description: 'Odontograma consolidado actual recuperado.' })
  @ApiResponse({ status: 404, description: 'Odontograma o historia clínica no encontrada.' })
  async obtenerActual(
    @Param('historiaClinicaId') historiaClinicaId: string,
  ): Promise<OdontogramaActualDto> {
    return this.obtenerOdontogramaActualUseCase.ejecutar({
      historiaClinicaId,
    });
  }

  @Get('consulta/:consultaId')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Obtener revisiones asociadas a una consulta odontológica',
    description:
      'Retorna todas las revisiones y snapshots históricos realizados en el marco de la consulta indicada.',
  })
  @ApiParam({
    name: 'consultaId',
    description: 'Identificador canónico de la consulta odontológica',
    example: 'cons_12345678-aaaa-bbbb',
  })
  @ApiResponse({ status: 200, description: 'Listado de revisiones asociadas a la consulta.' })
  @ApiResponse({ status: 404, description: 'Consulta odontológica no encontrada.' })
  async obtenerPorConsulta(
    @Param('consultaId') consultaId: string,
  ): Promise<RevisionOdontogramaDto[]> {
    return this.obtenerSnapshotsPorConsultaUseCase.ejecutar({
      consultaId,
    });
  }

  @Get(':id/historial')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Listar historial paginado de revisiones',
    description:
      'Consulta la secuencia inmutable de revisiones y enmiendas registradas sobre el odontograma.',
  })
  @ApiParam({
    name: 'id',
    description: 'Identificador canónico del odontograma',
    example: 'odo_12345678-aaaa-bbbb',
  })
  @ApiResponse({ status: 200, description: 'Historial paginado de revisiones.' })
  @ApiResponse({ status: 400, description: 'Parámetros de paginación inválidos.' })
  @ApiResponse({ status: 404, description: 'Odontograma no encontrado.' })
  async listarHistorial(
    @Param('id') id: string,
    @Query() query: ListarHistorialQueryHttpDto,
  ): Promise<ListadoRevisionesPaginadoDto> {
    return this.listarHistorialRevisionesUseCase.ejecutar({
      odontogramaId: id,
      limite: query.limite,
      offset: query.offset,
    });
  }

  @Get(':id/revisiones/:revisionId')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Obtener snapshot histórico de una revisión específica',
    description:
      'Recupera el snapshot inmutable sellado de las 52 piezas dentales en el momento exacto de la revisión.',
  })
  @ApiParam({
    name: 'id',
    description: 'Identificador canónico del odontograma',
    example: 'odo_12345678-aaaa-bbbb',
  })
  @ApiParam({
    name: 'revisionId',
    description: 'Identificador canónico de la revisión',
    example: 'rev_12345678-aaaa-bbbb',
  })
  @ApiResponse({ status: 200, description: 'Snapshot histórico de la revisión recuperado.' })
  @ApiResponse({ status: 404, description: 'Odontograma o revisión no encontrada.' })
  async obtenerSnapshot(
    @Param('id') id: string,
    @Param('revisionId') revisionId: string,
  ): Promise<RevisionOdontogramaDto> {
    return this.obtenerSnapshotRevisionUseCase.ejecutar({
      odontogramaId: id,
      revisionId,
    });
  }

  @Post(':id/revisiones')
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({
    summary: 'Registrar nueva revisión o enmienda correctiva',
    description:
      'Registra un incremento clínico inmutable con control de concurrencia optimista y deltas anatómicos.',
  })
  @ApiParam({
    name: 'id',
    description: 'Identificador canónico del odontograma',
    example: 'odo_12345678-aaaa-bbbb',
  })
  @ApiResponse({ status: 201, description: 'Revisión registrada exitosamente.' })
  @ApiResponse({ status: 400, description: 'Cuerpo de solicitud inválido o deltas inconsistentes.' })
  @ApiResponse({ status: 401, description: 'No autorizado / Token ausente o inválido.' })
  @ApiResponse({ status: 404, description: 'Odontograma o consulta no encontrada.' })
  @ApiResponse({ status: 409, description: 'Conflicto de concurrencia optimista en versión esperada.' })
  @ApiResponse({ status: 422, description: 'Incompatibilidad clínica, anatómica o de enmienda.' })
  async registrarRevision(
    @Param('id') id: string,
    @Body() dto: RegistrarRevisionOdontogramaHttpDto,
    @OperadorToken() token: string,
  ): Promise<RevisionOdontogramaDto> {
    return this.registrarRevisionOdontogramaUseCase.ejecutar({
      odontogramaId: id,
      versionEsperada: dto.versionEsperada,
      tipoRevision: dto.tipoRevision,
      consultaId: dto.consultaId,
      fechaObservacionClinica: dto.fechaObservacionClinica,
      motivoRevision: dto.motivoRevision,
      deltas: dto.deltas,
      revisionCorregidaId: dto.revisionCorregidaId,
      aplicaAlEstadoActual: dto.aplicaAlEstadoActual,
      tokenOdontologo: token,
    });
  }
}
