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
  CrearLaboratorioUseCase,
  ListarLaboratoriosUseCase,
  ObtenerLaboratorioPorIdUseCase,
  ActualizarLaboratorioUseCase,
  CambiarEstadoLaboratorioUseCase,
} from '../../../application/use-cases/laboratorios.use-cases.js';
import {
  CrearLaboratorioHttpDto,
  ActualizarLaboratorioHttpDto,
  CambiarEstadoLaboratorioHttpDto,
} from '../dtos/laboratorio.http-dto.js';
import { OdontologoAuthGuard } from '../guards/odontologo-auth.guard.js';
import { RolesGuard } from '../../../../../infrastructure/auth/roles.guard.js';
import { Roles } from '../../../../../infrastructure/auth/roles.decorator.js';
import type { LaboratorioDto } from '../../../application/dtos/estudios.dtos.js';
import { EstadoCatalogo } from '../../../domain/enums/estado-catalogo.enum.js';

@Controller('laboratorios')
@UseGuards(OdontologoAuthGuard, RolesGuard)
export class LaboratoriosController {
  constructor(
    private readonly crearUseCase: CrearLaboratorioUseCase,
    private readonly listarUseCase: ListarLaboratoriosUseCase,
    private readonly obtenerPorIdUseCase: ObtenerLaboratorioPorIdUseCase,
    private readonly actualizarUseCase: ActualizarLaboratorioUseCase,
    private readonly cambiarEstadoUseCase: CambiarEstadoLaboratorioUseCase
  ) {}

  @Post()
  @Roles('ODONTOLOGO', 'ADMIN')
  @HttpCode(HttpStatus.CREATED)
  async crear(@Body() dto: CrearLaboratorioHttpDto): Promise<LaboratorioDto> {
    return this.crearUseCase.execute({
      nombre: dto.nombre,
      descripcion: dto.descripcion,
      contacto: dto.contacto,
    });
  }

  @Get()
  async listar(@Query('soloActivos') soloActivos?: string): Promise<LaboratorioDto[]> {
    const filtrarActivos = soloActivos === 'true' || soloActivos === '1';
    return this.listarUseCase.execute({ soloActivos: filtrarActivos });
  }

  @Get(':id')
  async obtenerPorId(@Param('id') id: string): Promise<LaboratorioDto> {
    return this.obtenerPorIdUseCase.execute(id);
  }

  @Put(':id')
  @Roles('ODONTOLOGO', 'ADMIN')
  async actualizar(
    @Param('id') id: string,
    @Body() dto: ActualizarLaboratorioHttpDto
  ): Promise<LaboratorioDto> {
    return this.actualizarUseCase.execute(id, {
      nombre: dto.nombre,
      descripcion: dto.descripcion,
      contacto: dto.contacto,
    });
  }

  @Patch(':id/estado')
  @Roles('ODONTOLOGO', 'ADMIN')
  async cambiarEstado(
    @Param('id') id: string,
    @Body() dto: CambiarEstadoLaboratorioHttpDto
  ): Promise<LaboratorioDto> {
    const esActivo = dto.estado !== undefined ? dto.estado === EstadoCatalogo.ACTIVO : Boolean(dto.activo);
    return this.cambiarEstadoUseCase.execute(id, esActivo);
  }
}
