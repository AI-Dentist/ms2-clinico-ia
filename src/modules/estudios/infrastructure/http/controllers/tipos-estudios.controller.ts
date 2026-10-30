import {
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  Patch,
  Post,
  Put,
  Query,
  UseGuards,
} from '@nestjs/common';
import {
  CrearTipoEstudioUseCase,
  ListarTiposEstudioUseCase,
  ObtenerTipoEstudioPorIdUseCase,
  ActualizarTipoEstudioUseCase,
  CambiarEstadoTipoEstudioUseCase,
} from '../../../application/use-cases/tipos-estudio.use-cases.js';
import {
  CrearTipoEstudioHttpDto,
  ActualizarTipoEstudioHttpDto,
  CambiarEstadoTipoEstudioHttpDto,
} from '../dtos/tipo-estudio.http-dto.js';
import { OdontologoAuthGuard } from '../guards/odontologo-auth.guard.js';
import { RolesGuard } from '../../../../../infrastructure/auth/roles.guard.js';
import { Roles } from '../../../../../infrastructure/auth/roles.decorator.js';
import type { TipoEstudioDto } from '../../../application/dtos/estudios.dtos.js';
import { CategoriaEstudio } from '../../../domain/enums/categoria-estudio.enum.js';
import { EstadoCatalogo } from '../../../domain/enums/estado-catalogo.enum.js';

@Controller('tipos-estudios')
@UseGuards(OdontologoAuthGuard, RolesGuard)
export class TiposEstudiosController {
  constructor(
    private readonly crearUseCase: CrearTipoEstudioUseCase,
    private readonly listarUseCase: ListarTiposEstudioUseCase,
    private readonly obtenerPorIdUseCase: ObtenerTipoEstudioPorIdUseCase,
    private readonly actualizarUseCase: ActualizarTipoEstudioUseCase,
    private readonly cambiarEstadoUseCase: CambiarEstadoTipoEstudioUseCase
  ) {}

  @Post()
  @Roles('ODONTOLOGO', 'ADMIN')
  @HttpCode(HttpStatus.CREATED)
  async crear(@Body() dto: CrearTipoEstudioHttpDto): Promise<TipoEstudioDto> {
    return this.crearUseCase.execute({
      codigo: dto.codigo,
      nombre: dto.nombre,
      categoria: dto.categoria,
      descripcion: dto.descripcion,
    });
  }

  @Get()
  async listar(
    @Query('categoria') categoria?: CategoriaEstudio,
    @Query('soloActivos') soloActivos?: string
  ): Promise<TipoEstudioDto[]> {
    const filtrarActivos = soloActivos === 'true' || soloActivos === '1';
    return this.listarUseCase.execute({
      categoria,
      soloActivos: filtrarActivos,
    });
  }

  @Get(':id')
  async obtenerPorId(@Param('id') id: string): Promise<TipoEstudioDto> {
    return this.obtenerPorIdUseCase.execute(id);
  }

  @Put(':id')
  @Roles('ODONTOLOGO', 'ADMIN')
  async actualizar(
    @Param('id') id: string,
    @Body() dto: ActualizarTipoEstudioHttpDto
  ): Promise<TipoEstudioDto> {
    return this.actualizarUseCase.execute(id, {
      nombre: dto.nombre,
      categoria: dto.categoria,
      descripcion: dto.descripcion,
    });
  }

  @Patch(':id/estado')
  @Roles('ODONTOLOGO', 'ADMIN')
  async cambiarEstado(
    @Param('id') id: string,
    @Body() dto: CambiarEstadoTipoEstudioHttpDto
  ): Promise<TipoEstudioDto> {
    const esActivo = dto.estado !== undefined ? dto.estado === EstadoCatalogo.ACTIVO : Boolean(dto.activo);
    return this.cambiarEstadoUseCase.execute(id, esActivo);
  }
}
