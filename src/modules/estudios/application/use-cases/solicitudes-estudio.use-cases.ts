import { Inject, Injectable } from '@nestjs/common';
import crypto from 'node:crypto';
import {
  SOLICITUD_ESTUDIO_REPOSITORY,
  type ISolicitudEstudioRepositoryPort,
} from '../../domain/ports/solicitud-estudio.repository.port.js';
import {
  TIPO_ESTUDIO_REPOSITORY,
  type ITipoEstudioRepositoryPort,
} from '../../domain/ports/tipo-estudio.repository.port.js';
import {
  LABORATORIO_REPOSITORY,
  type ILaboratorioRepositoryPort,
} from '../../domain/ports/laboratorio.repository.port.js';
import {
  CONSULTA_CONTEXT_PORT,
  type IConsultaContextPort,
} from '../../domain/ports/consulta-context.port.js';
import {
  ODONTOLOGO_CONTEXT_PORT,
  type IOdontologoContextPort,
} from '../../domain/ports/odontologo-context.port.js';
import { SolicitudEstudio } from '../../domain/entities/solicitud-estudio.entity.js';
import { ResultadoEstudio, type ValorReferencia } from '../../domain/entities/resultado-estudio.entity.js';
import {
  SolicitudEstudioNoEncontradaError,
  TipoEstudioNoEncontradoError,
  LaboratorioNoEncontradoError,
} from '../../domain/errors/not-found-estudios.errors.js';
import {
  ConsultaInvalidaParaEstudioError,
  TransicionSolicitudInvalidaError,
} from '../../domain/errors/unprocessable-estudios.errors.js';
import { ResultadoYaRegistradoError } from '../../domain/errors/conflict-estudios.errors.js';
import { EstudiosMapper } from '../estudios.mapper.js';
import type { SolicitudEstudioDto } from '../dtos/estudios.dtos.js';
import { PrioridadEstudio } from '../../domain/enums/prioridad-estudio.enum.js';
import { EstadoSolicitudEstudio } from '../../domain/enums/estado-solicitud-estudio.enum.js';

export interface CrearSolicitudEstudioCommand {
  consultaId: string;
  tipoEstudioId: string;
  motivo: string;
  indicaciones?: string | null;
  prioridad?: PrioridadEstudio;
  tokenOdontologo: string;
}

export interface RegistrarResultadoEstudioCommand {
  solicitudId: string;
  laboratorioId?: string | null;
  fechaResultado?: Date | string;
  resumen: string;
  observaciones?: string | null;
  valoresReferencia?: ValorReferencia[] | null;
  tokenOdontologo: string;
}

@Injectable()
export class CrearSolicitudEstudioUseCase {
  constructor(
    @Inject(SOLICITUD_ESTUDIO_REPOSITORY)
    private readonly solicitudRepo: ISolicitudEstudioRepositoryPort,
    @Inject(TIPO_ESTUDIO_REPOSITORY)
    private readonly tipoEstudioRepo: ITipoEstudioRepositoryPort,
    @Inject(CONSULTA_CONTEXT_PORT)
    private readonly consultaContext: IConsultaContextPort,
    @Inject(ODONTOLOGO_CONTEXT_PORT)
    private readonly odontologoContext: IOdontologoContextPort
  ) {}

  async execute(cmd: CrearSolicitudEstudioCommand): Promise<SolicitudEstudioDto> {
    // 1. Validar contexto de consulta odontológica
    const resumenConsulta = await this.consultaContext.obtenerResumenConsulta(cmd.consultaId.trim());
    if (!resumenConsulta || !resumenConsulta.existe) {
      throw new ConsultaInvalidaParaEstudioError(
        `La consulta '${cmd.consultaId}' no existe en el sistema clínico.`
      );
    }
    if (resumenConsulta.estado !== 'EN_CURSO') {
      throw new ConsultaInvalidaParaEstudioError(
        `Solo es posible solicitar estudios clínicos en consultas con estado EN_CURSO (estado actual: '${resumenConsulta.estado}').`
      );
    }

    // 2. Validar tipo de estudio
    const tipo = await this.tipoEstudioRepo.buscarPorId(cmd.tipoEstudioId.trim());
    if (!tipo) {
      throw new TipoEstudioNoEncontradoError(cmd.tipoEstudioId);
    }
    if (!tipo.estaActivo) {
      throw new ConsultaInvalidaParaEstudioError(
        `El tipo de estudio '${tipo.nombre}' (${tipo.codigo}) se encuentra INACTIVO y no admite nuevas solicitudes.`
      );
    }

    // 3. Resolver odontólogo solicitante
    const odCtx = await this.odontologoContext.obtenerOdontologoActual(cmd.tokenOdontologo);

    // 4. Crear entidad de solicitud
    const solicitud = SolicitudEstudio.crear({
      id: `sol_${crypto.randomUUID()}`,
      historiaClinicaId: resumenConsulta.historiaClinicaId,
      consultaId: cmd.consultaId.trim(),
      pacienteId: resumenConsulta.pacienteId,
      odontologoId: odCtx.odontologoId,
      tipoEstudioId: tipo.id,
      motivo: cmd.motivo,
      indicaciones: cmd.indicaciones,
      prioridad: cmd.prioridad,
    });

    const guardada = await this.solicitudRepo.guardar(solicitud);
    return EstudiosMapper.solicitudToDto(guardada, tipo);
  }
}

@Injectable()
export class ListarSolicitudesPorConsultaUseCase {
  constructor(
    @Inject(SOLICITUD_ESTUDIO_REPOSITORY)
    private readonly solicitudRepo: ISolicitudEstudioRepositoryPort,
    @Inject(TIPO_ESTUDIO_REPOSITORY)
    private readonly tipoEstudioRepo: ITipoEstudioRepositoryPort,
    @Inject(LABORATORIO_REPOSITORY)
    private readonly labRepo: ILaboratorioRepositoryPort
  ) {}

  async execute(consultaId: string): Promise<SolicitudEstudioDto[]> {
    const list = await this.solicitudRepo.listarPorConsulta(consultaId.trim());
    return this.enrichSolicitudes(list);
  }

  private async enrichSolicitudes(list: SolicitudEstudio[]): Promise<SolicitudEstudioDto[]> {
    const dtos: SolicitudEstudioDto[] = [];
    for (const sol of list) {
      const tipo = await this.tipoEstudioRepo.buscarPorId(sol.tipoEstudioId);
      let labNombre: string | null = null;
      if (sol.resultado?.laboratorioId) {
        const lab = await this.labRepo.buscarPorId(sol.resultado.laboratorioId);
        labNombre = lab ? lab.nombre : null;
      }
      dtos.push(EstudiosMapper.solicitudToDto(sol, tipo, labNombre));
    }
    return dtos;
  }
}

@Injectable()
export class ListarSolicitudesPorHistoriaUseCase {
  constructor(
    @Inject(SOLICITUD_ESTUDIO_REPOSITORY)
    private readonly solicitudRepo: ISolicitudEstudioRepositoryPort,
    @Inject(TIPO_ESTUDIO_REPOSITORY)
    private readonly tipoEstudioRepo: ITipoEstudioRepositoryPort,
    @Inject(LABORATORIO_REPOSITORY)
    private readonly labRepo: ILaboratorioRepositoryPort
  ) {}

  async execute(historiaClinicaId: string): Promise<SolicitudEstudioDto[]> {
    const list = await this.solicitudRepo.listarPorHistoriaClinica(historiaClinicaId.trim());
    const dtos: SolicitudEstudioDto[] = [];
    for (const sol of list) {
      const tipo = await this.tipoEstudioRepo.buscarPorId(sol.tipoEstudioId);
      let labNombre: string | null = null;
      if (sol.resultado?.laboratorioId) {
        const lab = await this.labRepo.buscarPorId(sol.resultado.laboratorioId);
        labNombre = lab ? lab.nombre : null;
      }
      dtos.push(EstudiosMapper.solicitudToDto(sol, tipo, labNombre));
    }
    return dtos;
  }
}

@Injectable()
export class ObtenerSolicitudEstudioPorIdUseCase {
  constructor(
    @Inject(SOLICITUD_ESTUDIO_REPOSITORY)
    private readonly solicitudRepo: ISolicitudEstudioRepositoryPort,
    @Inject(TIPO_ESTUDIO_REPOSITORY)
    private readonly tipoEstudioRepo: ITipoEstudioRepositoryPort,
    @Inject(LABORATORIO_REPOSITORY)
    private readonly labRepo: ILaboratorioRepositoryPort
  ) {}

  async execute(id: string): Promise<SolicitudEstudioDto> {
    const sol = await this.solicitudRepo.buscarPorId(id.trim());
    if (!sol) {
      throw new SolicitudEstudioNoEncontradaError(id);
    }
    const tipo = await this.tipoEstudioRepo.buscarPorId(sol.tipoEstudioId);
    let labNombre: string | null = null;
    if (sol.resultado?.laboratorioId) {
      const lab = await this.labRepo.buscarPorId(sol.resultado.laboratorioId);
      labNombre = lab ? lab.nombre : null;
    }
    return EstudiosMapper.solicitudToDto(sol, tipo, labNombre);
  }
}

@Injectable()
export class CambiarEstadoSolicitudUseCase {
  constructor(
    @Inject(SOLICITUD_ESTUDIO_REPOSITORY)
    private readonly solicitudRepo: ISolicitudEstudioRepositoryPort,
    @Inject(TIPO_ESTUDIO_REPOSITORY)
    private readonly tipoEstudioRepo: ITipoEstudioRepositoryPort
  ) {}

  async execute(
    id: string,
    nuevoEstado: EstadoSolicitudEstudio,
    motivoCancelacion?: string
  ): Promise<SolicitudEstudioDto> {
    const sol = await this.solicitudRepo.buscarPorId(id.trim());
    if (!sol) {
      throw new SolicitudEstudioNoEncontradaError(id);
    }

    if (nuevoEstado === EstadoSolicitudEstudio.EN_PROCESO) {
      try {
        sol.iniciarProceso();
      } catch (err: any) {
        throw new TransicionSolicitudInvalidaError(err.message);
      }
    } else if (nuevoEstado === EstadoSolicitudEstudio.CANCELADO) {
      if (!motivoCancelacion || !motivoCancelacion.trim()) {
        throw new TransicionSolicitudInvalidaError(
          'Es obligatorio especificar un motivo de cancelación clínico.'
        );
      }
      try {
        sol.cancelar(motivoCancelacion);
      } catch (err: any) {
        throw new TransicionSolicitudInvalidaError(err.message);
      }
    } else {
      throw new TransicionSolicitudInvalidaError(
        `Para completar una solicitud use el registro de resultados. Transición directa a '${nuevoEstado}' no permitida.`
      );
    }

    const guardada = await this.solicitudRepo.guardar(sol);
    const tipo = await this.tipoEstudioRepo.buscarPorId(guardada.tipoEstudioId);
    return EstudiosMapper.solicitudToDto(guardada, tipo);
  }
}

@Injectable()
export class RegistrarResultadoEstudioUseCase {
  constructor(
    @Inject(SOLICITUD_ESTUDIO_REPOSITORY)
    private readonly solicitudRepo: ISolicitudEstudioRepositoryPort,
    @Inject(TIPO_ESTUDIO_REPOSITORY)
    private readonly tipoEstudioRepo: ITipoEstudioRepositoryPort,
    @Inject(LABORATORIO_REPOSITORY)
    private readonly labRepo: ILaboratorioRepositoryPort,
    @Inject(ODONTOLOGO_CONTEXT_PORT)
    private readonly odontologoContext: IOdontologoContextPort
  ) {}

  async execute(cmd: RegistrarResultadoEstudioCommand): Promise<SolicitudEstudioDto> {
    const sol = await this.solicitudRepo.buscarPorId(cmd.solicitudId.trim());
    if (!sol) {
      throw new SolicitudEstudioNoEncontradaError(cmd.solicitudId);
    }

    if (sol.tieneResultado) {
      throw new ResultadoYaRegistradoError(sol.id);
    }

    if (sol.estado === EstadoSolicitudEstudio.CANCELADO) {
      throw new TransicionSolicitudInvalidaError(
        'No es posible registrar un resultado clínico en una solicitud que ha sido cancelada.'
      );
    }

    let labNombre: string | null = null;
    if (cmd.laboratorioId && cmd.laboratorioId.trim()) {
      const lab = await this.labRepo.buscarPorId(cmd.laboratorioId.trim());
      if (!lab) {
        throw new LaboratorioNoEncontradoError(cmd.laboratorioId);
      }
      labNombre = lab.nombre;
    }

    const odCtx = await this.odontologoContext.obtenerOdontologoActual(cmd.tokenOdontologo);

    const fechaRes = cmd.fechaResultado
      ? new Date(cmd.fechaResultado)
      : new Date();

    const resultado = ResultadoEstudio.crear({
      id: `res_${crypto.randomUUID()}`,
      solicitudEstudioId: sol.id,
      laboratorioId: cmd.laboratorioId ? cmd.laboratorioId.trim() : null,
      fechaResultado: fechaRes,
      registradoPor: odCtx.odontologoId,
      resumen: cmd.resumen,
      observaciones: cmd.observaciones,
      valoresReferencia: cmd.valoresReferencia,
    });

    try {
      sol.registrarResultado(resultado);
    } catch (err: any) {
      throw new TransicionSolicitudInvalidaError(err.message);
    }

    const guardada = await this.solicitudRepo.guardar(sol);
    const tipo = await this.tipoEstudioRepo.buscarPorId(guardada.tipoEstudioId);
    return EstudiosMapper.solicitudToDto(guardada, tipo, labNombre);
  }
}
