import { Controller, Get, Inject } from '@nestjs/common';
import { ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';
import {
  OUTBOX_REPOSITORY_PORT,
  type IOutboxRepositoryPort,
  type OutboxStatusDto,
} from '../../domain/ports/outbox-repository.port.js';

@ApiTags('Outbox')
@Controller('outbox')
export class OutboxController {
  constructor(
    @Inject(OUTBOX_REPOSITORY_PORT)
    private readonly outboxRepository: IOutboxRepositoryPort,
  ) {}

  @Get('status')
  @ApiOperation({
    summary: 'Consultar estado consolidado del relay Outbox',
    description:
      'Retorna métricas agregadas de eventos pendientes, en proceso, publicados y terminales (ERROR_FATAL), permitiendo observabilidad de fallos en la publicación asíncrona hacia RabbitMQ.',
  })
  @ApiResponse({
    status: 200,
    description: 'Estado consolidado del outbox y lista de eventos fatales',
  })
  async obtenerEstado(): Promise<OutboxStatusDto> {
    return await this.outboxRepository.obtenerEstado();
  }
}
