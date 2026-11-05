import { Inject, Injectable, Logger } from '@nestjs/common';
import {
  CONSULTA_ODONTOLOGICA_REPOSITORY,
  type IConsultaOdontologicaRepositoryPort,
} from '../../domain/ports/consulta-odontologica.repository.port.js';
import {
  INBOX_REPOSITORY_PORT,
  type IInboxRepositoryPort,
} from '../ports/inbox-repository.port.js';
import {
  UNIT_OF_WORK_COMPENSACION_PORT,
  type IUnitOfWorkCompensacionPort,
} from '../ports/unit-of-work-compensacion.port.js';
import { ConsultaId } from '../../domain/value-objects/consulta-id.vo.js';
import { EstadoConsulta } from '../../domain/value-objects/estado-consulta.enum.js';

export interface RevertirCierrePorRechazoCommand {
  eventId: string;
  consultaId: string;
  consultaFinalizadaEventId: string;
  motivoCodigo: string;
  motivo: string;
  rechazadaEn: string;
}

export interface RevertirCierreResultado {
  revertido: boolean;
  motivo?:
    | 'DUPLICADO'
    | 'CONSULTA_NO_ENCONTRADA'
    | 'CONSULTA_NO_COMPLETADA'
    | 'EVENTO_CIERRE_OBSOLETO'
    | 'EXITO';
}

@Injectable()
export class RevertirCierrePorRechazoUseCase {
  private readonly logger = new Logger(RevertirCierrePorRechazoUseCase.name);

  constructor(
    @Inject(CONSULTA_ODONTOLOGICA_REPOSITORY)
    private readonly consultaRepository: IConsultaOdontologicaRepositoryPort,
    @Inject(INBOX_REPOSITORY_PORT)
    private readonly inboxRepository: IInboxRepositoryPort,
    @Inject(UNIT_OF_WORK_COMPENSACION_PORT)
    private readonly unitOfWork: IUnitOfWorkCompensacionPort,
  ) {}

  async execute(command: RevertirCierrePorRechazoCommand): Promise<RevertirCierreResultado> {
    return this.unitOfWork.ejecutarCompensacion(async (session) => {
      // 1. Verificación de idempotencia en Inbox
      const yaProcesado = await this.inboxRepository.existe(command.eventId, session);
      if (yaProcesado) {
        this.logger.log(
          `[RevertirCierrePorRechazoUseCase] Evento de rechazo ${command.eventId} ya fue procesado previamente. Ignorando deduplicado.`,
        );
        return { revertido: false, motivo: 'DUPLICADO' };
      }

      // 2. Buscar la consulta clínica
      let consultaId: ConsultaId;
      try {
        consultaId = ConsultaId.reconstituir(command.consultaId);
      } catch {
        // Formato inválido o no encontrado -> no reintentar
        await this.inboxRepository.guardar(
          {
            eventId: command.eventId,
            tipoEvento: 'facturacion.consulta.rechazada',
            procesadoEn: new Date(),
          },
          session,
        );
        return { revertido: false, motivo: 'CONSULTA_NO_ENCONTRADA' };
      }

      const consulta = await this.consultaRepository.buscarPorId(consultaId);
      if (!consulta) {
        this.logger.warn(
          `[RevertirCierrePorRechazoUseCase] Consulta ${command.consultaId} no encontrada. Descartando rechazo sin DLQ.`,
        );
        await this.inboxRepository.guardar(
          {
            eventId: command.eventId,
            tipoEvento: 'facturacion.consulta.rechazada',
            procesadoEn: new Date(),
          },
          session,
        );
        return { revertido: false, motivo: 'CONSULTA_NO_ENCONTRADA' };
      }

      // 3. Verificar estado COMPLETADA
      if (consulta.estado !== EstadoConsulta.COMPLETADA) {
        this.logger.warn(
          `[RevertirCierrePorRechazoUseCase] Consulta ${command.consultaId} se encuentra en estado '${consulta.estado}', no COMPLETADA. No se revierte.`,
        );
        await this.inboxRepository.guardar(
          {
            eventId: command.eventId,
            tipoEvento: 'facturacion.consulta.rechazada',
            procesadoEn: new Date(),
          },
          session,
        );
        return { revertido: false, motivo: 'CONSULTA_NO_COMPLETADA' };
      }

      // 4. Guardia de versión de cierre vigente (INV-SAGA-01):
      // SOLO revertir si consultaFinalizadaEventId coincide con el evento outbox del cierre vigente
      if (consulta.ultimoOutboxEventId !== command.consultaFinalizadaEventId) {
        this.logger.warn(
          `[RevertirCierrePorRechazoUseCase] Guardia de versión: el evento de cierre rechazado (${command.consultaFinalizadaEventId}) no coincide con el cierre vigente (${consulta.ultimoOutboxEventId}) de la consulta ${command.consultaId}. Rechazo obsoleto descartado.`,
        );
        await this.inboxRepository.guardar(
          {
            eventId: command.eventId,
            tipoEvento: 'facturacion.consulta.rechazada',
            procesadoEn: new Date(),
          },
          session,
        );
        return { revertido: false, motivo: 'EVENTO_CIERRE_OBSOLETO' };
      }

      // 5. Revertir en el Aggregate Root (COMPLETADA -> EN_CURSO) preservando todo lo clínico
      const rechazadaEn = new Date(command.rechazadaEn);
      consulta.revertirCierrePorRechazoFacturacion({
        motivoCodigo: command.motivoCodigo,
        motivo: command.motivo,
        rechazadaEn,
      });

      // 6. Persistir consulta actualizada y registrar en Inbox dentro de la misma sesión
      await this.consultaRepository.actualizar(consulta, consulta.version - 1, session);
      await this.inboxRepository.guardar(
        {
          eventId: command.eventId,
          tipoEvento: 'facturacion.consulta.rechazada',
          procesadoEn: new Date(),
        },
        session,
      );

      this.logger.log(
        `[RevertirCierrePorRechazoUseCase] Consulta ${command.consultaId} revertida a EN_CURSO exitosamente (motivo: ${command.motivoCodigo}).`,
      );

      return { revertido: true, motivo: 'EXITO' };
    });
  }
}
