import {
  BadRequestException,
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  Patch,
  Post,
  Put,
  Query,
  Req,
  UseGuards,
} from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiOperation,
  ApiResponse,
  ApiTags,
} from '@nestjs/swagger';
import { OdontologoAuthGuard, type RequestConOperador } from '../guards/odontologo-auth.guard.js';
import { RolesGuard } from '../../../../../infrastructure/auth/roles.guard.js';
import { Roles } from '../../../../../infrastructure/auth/roles.decorator.js';
import { OperadorToken } from '../decorators/operador-token.decorator.js';
import { CrearHistoriaClinicaHttpDto } from '../dtos/crear-historia-clinica.http-dto.js';
import { ActualizarAntecedentesHttpDto } from '../dtos/actualizar-antecedentes.http-dto.js';
import { AgregarAlergiaHttpDto } from '../dtos/agregar-alergia.http-dto.js';
import { EliminarAlergiaHttpDto } from '../dtos/eliminar-alergia.http-dto.js';
import { ActualizarMedicamentosHttpDto } from '../dtos/actualizar-medicamentos.http-dto.js';
import { CambiarEstadoHistoriaHttpDto } from '../dtos/cambiar-estado-historia.http-dto.js';
import { BuscarHistoriasQueryHttpDto } from '../dtos/buscar-historias-query.http-dto.js';

// Casos de uso de la capa Application
import {
  CrearHistoriaClinicaUseCase,
  ObtenerHistoriaPorIdUseCase,
  ObtenerHistoriaPorPacienteUseCase,
  ActualizarAntecedentesUseCase,
  AgregarAlergiaUseCase,
  EliminarAlergiaUseCase,
  ActualizarMedicamentosUseCase,
  CambiarEstadoHistoriaUseCase,
  type HistoriaClinicaResponseDto,
} from '../../../application/index.js';

@ApiTags('Historias Clínicas')
@ApiBearerAuth('JWT')
@Controller('historias-clinicas')
@UseGuards(OdontologoAuthGuard, RolesGuard)
export class HistoriasClinicasController {
  constructor(
    private readonly crearHistoriaClinicaUseCase: CrearHistoriaClinicaUseCase,
    private readonly obtenerHistoriaPorIdUseCase: ObtenerHistoriaPorIdUseCase,
    private readonly obtenerHistoriaPorPacienteUseCase: ObtenerHistoriaPorPacienteUseCase,
    private readonly actualizarAntecedentesUseCase: ActualizarAntecedentesUseCase,
    private readonly agregarAlergiaUseCase: AgregarAlergiaUseCase,
    private readonly eliminarAlergiaUseCase: EliminarAlergiaUseCase,
    private readonly actualizarMedicamentosUseCase: ActualizarMedicamentosUseCase,
    private readonly cambiarEstadoHistoriaUseCase: CambiarEstadoHistoriaUseCase,
  ) {}

  @Post()
  @Roles('ODONTOLOGO', 'ADMIN')
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({ summary: 'Crear apertura de expediente clínico odontológico' })
  @ApiResponse({ status: 201, description: 'Expediente clínico abierto exitosamente' })
  @ApiResponse({ status: 400, description: 'Datos de solicitud inválidos' })
  @ApiResponse({ status: 401, description: 'No autorizado / Token ausente o inválido' })
  @ApiResponse({ status: 403, description: 'Acceso denegado: rol clínico insuficiente' })
  @ApiResponse({ status: 409, description: 'El paciente ya cuenta con un expediente clínico' })
  @ApiResponse({ status: 422, description: 'Paciente inexistente en MS1 o datos clínicos inválidos' })
  async crear(
    @OperadorToken() token: string,
    @Body() dto: CrearHistoriaClinicaHttpDto,
    @Req() req?: RequestConOperador,
  ): Promise<HistoriaClinicaResponseDto> {
    const operadorAutenticadoId = req?.odontologoActual?.odontologoId;
    let odontologoResponsableId = dto.odontologoResponsableId;

    if (operadorAutenticadoId) {
      if (
        dto.odontologoResponsableId &&
        dto.odontologoResponsableId !== operadorAutenticadoId
      ) {
        throw new BadRequestException(
          `El odontólogo responsable (${dto.odontologoResponsableId}) debe coincidir con el operador autenticado (${operadorAutenticadoId}).`,
        );
      }
      odontologoResponsableId = operadorAutenticadoId;
    }

    return this.crearHistoriaClinicaUseCase.execute({
      tokenAutenticacion: token,
      pacienteId: dto.pacienteId,
      odontologoResponsableId,
      antecedentes: dto.antecedentes,
      observacionesGenerales: dto.observacionesGenerales,
    });
  }

  @Get(':id')
  @ApiOperation({ summary: 'Obtener detalle de historia clínica por ID' })
  @ApiResponse({ status: 200, description: 'Expediente clínico recuperado' })
  @ApiResponse({ status: 401, description: 'No autorizado' })
  @ApiResponse({ status: 404, description: 'Historia clínica no encontrada' })
  async obtenerPorId(
    @OperadorToken() _token: string,
    @Param('id') id: string,
  ): Promise<HistoriaClinicaResponseDto> {
    return this.obtenerHistoriaPorIdUseCase.execute({ id });
  }

  @Get()
  @ApiOperation({ summary: 'Buscar expediente clínico por identificador de paciente' })
  @ApiResponse({ status: 200, description: 'Expediente encontrado para el paciente' })
  @ApiResponse({ status: 400, description: 'Parámetro pacienteId ausente' })
  @ApiResponse({ status: 401, description: 'No autorizado' })
  @ApiResponse({ status: 404, description: 'No existe expediente para el paciente' })
  async buscar(
    @OperadorToken() _token: string,
    @Query() query: BuscarHistoriasQueryHttpDto,
  ): Promise<HistoriaClinicaResponseDto[]> {
    const pacienteId = query.pacienteId?.trim();
    if (!pacienteId) {
      throw new BadRequestException('El parámetro de consulta pacienteId es requerido.');
    }

    const historia = await this.obtenerHistoriaPorPacienteUseCase.execute({
      pacienteId,
    });
    return [historia];
  }

  @Patch(':id/antecedentes')
  @Roles('ODONTOLOGO', 'ADMIN')
  @ApiOperation({ summary: 'Actualizar antecedentes personales, médicos u odontológicos' })
  @ApiResponse({ status: 200, description: 'Antecedentes actualizados exitosamente' })
  @ApiResponse({ status: 400, description: 'Estructura o versión inválida' })
  @ApiResponse({ status: 401, description: 'No autorizado' })
  @ApiResponse({ status: 403, description: 'Acceso denegado: rol clínico insuficiente' })
  @ApiResponse({ status: 404, description: 'Historia clínica no encontrada' })
  @ApiResponse({ status: 409, description: 'Conflicto de concurrencia optimista (versionEsperada desactualizada)' })
  @ApiResponse({ status: 422, description: 'Expediente no editable o regla clínica incumplida' })
  async actualizarAntecedentes(
    @OperadorToken() token: string,
    @Param('id') id: string,
    @Body() dto: ActualizarAntecedentesHttpDto,
  ): Promise<HistoriaClinicaResponseDto> {
    return this.actualizarAntecedentesUseCase.execute({
      tokenAutenticacion: token,
      historiaClinicaId: id,
      versionEsperada: dto.versionEsperada,
      nuevosAntecedentes: dto.nuevosAntecedentes,
      camposModificados: dto.camposModificados,
      descripcion: dto.descripcion,
    });
  }

  @Post(':id/alergias')
  @Roles('ODONTOLOGO', 'ADMIN')
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({ summary: 'Registrar nueva alergia en el expediente' })
  @ApiResponse({ status: 201, description: 'Alergia registrada exitosamente' })
  @ApiResponse({ status: 400, description: 'Datos de alergia inválidos' })
  @ApiResponse({ status: 401, description: 'No autorizado' })
  @ApiResponse({ status: 403, description: 'Acceso denegado: rol clínico insuficiente' })
  @ApiResponse({ status: 404, description: 'Historia clínica no encontrada' })
  @ApiResponse({ status: 409, description: 'Conflicto de concurrencia optimista' })
  @ApiResponse({ status: 422, description: 'Alergia duplicada o expediente no editable' })
  async agregarAlergia(
    @OperadorToken() token: string,
    @Param('id') id: string,
    @Body() dto: AgregarAlergiaHttpDto,
  ): Promise<HistoriaClinicaResponseDto> {
    return this.agregarAlergiaUseCase.execute({
      tokenAutenticacion: token,
      historiaClinicaId: id,
      versionEsperada: dto.versionEsperada,
      alergia: {
        sustancia: dto.sustancia,
        tipoReaccion: dto.tipoReaccion,
        severidad: dto.severidad,
        notasAdicionales: dto.notasAdicionales,
      },
      descripcion: dto.descripcion,
    });
  }

  @Delete(':id/alergias/:sustancia')
  @Roles('ODONTOLOGO', 'ADMIN')
  @ApiOperation({ summary: 'Eliminar alergia por sustancia (case-insensitive)' })
  @ApiResponse({ status: 200, description: 'Alergia eliminada exitosamente' })
  @ApiResponse({ status: 400, description: 'Parámetros inválidos' })
  @ApiResponse({ status: 401, description: 'No autorizado' })
  @ApiResponse({ status: 403, description: 'Acceso denegado: rol clínico insuficiente' })
  @ApiResponse({ status: 404, description: 'Historia clínica o sustancia no encontrada' })
  @ApiResponse({ status: 409, description: 'Conflicto de concurrencia optimista' })
  @ApiResponse({ status: 422, description: 'Expediente no editable' })
  async eliminarAlergia(
    @OperadorToken() token: string,
    @Param('id') id: string,
    @Param('sustancia') sustancia: string,
    @Body() dto: EliminarAlergiaHttpDto,
  ): Promise<HistoriaClinicaResponseDto> {
    return this.eliminarAlergiaUseCase.execute({
      tokenAutenticacion: token,
      historiaClinicaId: id,
      versionEsperada: dto.versionEsperada,
      sustancia,
      descripcion: dto.descripcion,
    });
  }

  @Put(':id/medicamentos')
  @Roles('ODONTOLOGO', 'ADMIN')
  @ApiOperation({ summary: 'Reemplazar listado de medicamentos actuales' })
  @ApiResponse({ status: 200, description: 'Medicamentos actualizados exitosamente' })
  @ApiResponse({ status: 400, description: 'Datos de fármacos inválidos' })
  @ApiResponse({ status: 401, description: 'No autorizado' })
  @ApiResponse({ status: 403, description: 'Acceso denegado: rol clínico insuficiente' })
  @ApiResponse({ status: 404, description: 'Historia clínica no encontrada' })
  @ApiResponse({ status: 409, description: 'Conflicto de concurrencia optimista' })
  @ApiResponse({ status: 422, description: 'Expediente no editable' })
  async actualizarMedicamentos(
    @OperadorToken() token: string,
    @Param('id') id: string,
    @Body() dto: ActualizarMedicamentosHttpDto,
  ): Promise<HistoriaClinicaResponseDto> {
    return this.actualizarMedicamentosUseCase.execute({
      tokenAutenticacion: token,
      historiaClinicaId: id,
      versionEsperada: dto.versionEsperada,
      medicamentos: dto.medicamentos,
      descripcion: dto.descripcion,
    });
  }

  @Patch(':id/estado')
  @Roles('ODONTOLOGO', 'ADMIN')
  @ApiOperation({ summary: 'Cambiar estado del expediente clínico (máquina de estados)' })
  @ApiResponse({ status: 200, description: 'Estado actualizado exitosamente' })
  @ApiResponse({ status: 400, description: 'Estado destino inválido' })
  @ApiResponse({ status: 401, description: 'No autorizado' })
  @ApiResponse({ status: 403, description: 'Acceso denegado: rol clínico insuficiente' })
  @ApiResponse({ status: 404, description: 'Historia clínica no encontrada' })
  @ApiResponse({ status: 409, description: 'Conflicto de concurrencia optimista' })
  @ApiResponse({ status: 422, description: 'Transición de estado no permitida' })
  async cambiarEstado(
    @OperadorToken() token: string,
    @Param('id') id: string,
    @Body() dto: CambiarEstadoHistoriaHttpDto,
  ): Promise<HistoriaClinicaResponseDto> {
    return this.cambiarEstadoHistoriaUseCase.execute({
      tokenAutenticacion: token,
      historiaClinicaId: id,
      versionEsperada: dto.versionEsperada,
      nuevoEstado: dto.nuevoEstado,
      descripcion: dto.descripcion,
    });
  }
}
