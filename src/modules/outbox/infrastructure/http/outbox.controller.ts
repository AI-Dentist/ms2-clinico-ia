import { Controller, Get, Inject, UseGuards } from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiOperation,
  ApiResponse,
  ApiTags,
} from '@nestjs/swagger';
import {
  OUTBOX_REPOSITORY_PORT,
  type IOutboxRepositoryPort,
  type OutboxStatusDto,
} from '../../domain/ports/outbox-repository.port.js';
import { OdontologoAuthGuard } from './guards/odontologo-auth.guard.js';
import { RolesGuard } from '../../../../infrastructure/auth/roles.guard.js';
import { Roles } from '../../../../infrastructure/auth/roles.decorator.js';

@ApiTags('Outbox')
@ApiBearerAuth('bearer')
@UseGuards(OdontologoAuthGuard, RolesGuard)
@Controller('outbox')
export class OutboxController {
  constructor(
    @Inject(OUTBOX_REPOSITORY_PORT)
    private readonly outboxRepository: IOutboxRepositoryPort,
  ) {}

  @Get('status')
  @Roles('ADMIN')
  @ApiOperation({
    summary: 'Consultar estado consolidado del relay Outbox (Solo ADMIN)',
    description:
      'Retorna métricas agregadas de eventos pendientes, en proceso, publicados y terminales (ERROR_FATAL), permitiendo observabilidad de fallos en la publicación asíncrona hacia RabbitMQ. Requiere rol ADMIN.',
  })
  @ApiResponse({
    status: 200,
    description: 'Estado consolidado del outbox y lista de eventos fatales (sin payloads clínicos)',
  })
  @ApiResponse({
    status: 401,
    description: 'No autenticado o token ausente/inválido',
  })
  @ApiResponse({
    status: 403,
    description: 'Acceso denegado: se requiere rol ADMIN',
  })
  async obtenerEstado(): Promise<OutboxStatusDto> {
    return await this.outboxRepository.obtenerEstado();
  }
}

