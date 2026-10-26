import { Inject, Injectable } from '@nestjs/common';
import {
  type IOdontogramaRepositoryPort,
  ODONTOGRAMA_REPOSITORY,
} from '../../domain/ports/odontograma.repository.port.js';
import {
  type IHistoriaClinicaContextPort,
  HISTORIA_CLINICA_CONTEXT_PORT,
} from '../ports/historia-clinica-context.port.js';
import {
  type IConsultaOdontologicaContextPort,
  CONSULTA_ODONTOLOGICA_CONTEXT_PORT,
} from '../ports/consulta-odontologica-context.port.js';
import {
  type IOdontologoContextPort,
  ODONTOLOGO_CONTEXT_PORT,
} from '../ports/odontologo-context.port.js';
import type { RegistrarRevisionOdontogramaCommand } from '../commands/registrar-revision-odontograma.command.js';
import type { RevisionOdontogramaDto } from '../dtos/revision-odontograma.dto.js';
import { OdontogramaId } from '../../domain/value-objects/odontograma-id.vo.js';
import { RevisionId } from '../../domain/value-objects/revision-id.vo.js';
import { ConsultaId } from '../../../consultas-odontologicas/domain/value-objects/consulta-id.vo.js';
import { OdontologoId } from '../../../historias-clinicas/domain/value-objects/odontologo-id.vo.js';
import { TipoRevisionOdontograma } from '../../domain/value-objects/tipo-revision-odontograma.enum.js';
import type { DeltaPiezaOdontogramaProps } from '../../domain/value-objects/delta-pieza-odontograma.vo.js';
import type { EstadoAnatomicoPieza } from '../../domain/value-objects/estado-anatomico-pieza.enum.js';
import type { TipoSuperficie } from '../../domain/value-objects/tipo-superficie.enum.js';
import type { CondicionSuperficie } from '../../domain/value-objects/condicion-superficie.enum.js';
import type { TipoTratamientoEstructural } from '../../domain/value-objects/tipo-tratamiento-estructural.enum.js';
import { OdontogramaNoEncontradoError } from '../../domain/errors/odontograma-no-encontrado.error.js';
import { HistoriaClinicaInvalidaError } from '../errors/historia-clinica-invalida.error.js';
import { ConsultaInvalidaError } from '../errors/consulta-invalida.error.js';
import { RevisionInvalidaError } from '../errors/revision-invalida.error.js';
import { EnmiendaCorrectivaInvalidaError } from '../../domain/errors/enmienda-correctiva-invalida.error.js';
import { OdontogramaMapper } from '../mappers/odontograma.mapper.js';

@Injectable()
export class RegistrarRevisionOdontogramaUseCase {
  constructor(
    @Inject(ODONTOGRAMA_REPOSITORY)
    private readonly odontogramaRepository: IOdontogramaRepositoryPort,
    @Inject(HISTORIA_CLINICA_CONTEXT_PORT)
    private readonly historiaClinicaContext: IHistoriaClinicaContextPort,
    @Inject(CONSULTA_ODONTOLOGICA_CONTEXT_PORT)
    private readonly consultaContext: IConsultaOdontologicaContextPort,
    @Inject(ODONTOLOGO_CONTEXT_PORT)
    private readonly odontologoContext: IOdontologoContextPort
  ) {}

  async ejecutar(comando: RegistrarRevisionOdontogramaCommand): Promise<RevisionOdontogramaDto> {
    const odontogramaId = OdontogramaId.reconstituir(comando.odontogramaId);

    // 1. Validar existencia del Odontograma
    const odontograma = await this.odontogramaRepository.buscarPorId(odontogramaId);
    if (!odontograma) {
      throw new OdontogramaNoEncontradoError(odontogramaId.valor);
    }

    // 2. Validar que la Historia Clínica vinculada exista y esté ACTIVA
    const resumenHc = await this.historiaClinicaContext.obtenerResumenHistoria(
      odontograma.historiaClinicaId.valor
    );
    if (!resumenHc || !resumenHc.existe) {
      throw HistoriaClinicaInvalidaError.noEncontrada(odontograma.historiaClinicaId.valor);
    }
    if (resumenHc.estado !== 'ACTIVA') {
      throw HistoriaClinicaInvalidaError.noActiva(odontograma.historiaClinicaId.valor, resumenHc.estado);
    }

    // 3. Resolver identidad del odontólogo responsable
    const odontologoCtx = await this.odontologoContext.obtenerOdontologoActual(comando.tokenOdontologo);
    const odontologoId = OdontologoId.crear(odontologoCtx.odontologoId);

    // 4. Si se incluye ConsultaId, validar existencia, pertenencia clínica y estado EN_CURSO
    let consultaIdVo: ConsultaId | null = null;
    if (comando.consultaId) {
      consultaIdVo = ConsultaId.reconstituir(comando.consultaId);
      const resumenConsulta = await this.consultaContext.obtenerResumenConsulta(consultaIdVo.valor);
      if (!resumenConsulta || !resumenConsulta.existe) {
        throw ConsultaInvalidaError.noEncontrada(consultaIdVo.valor);
      }
      if (resumenConsulta.historiaClinicaId !== odontograma.historiaClinicaId.valor) {
        throw ConsultaInvalidaError.historiaDiferente(
          consultaIdVo.valor,
          odontograma.historiaClinicaId.valor,
          resumenConsulta.historiaClinicaId
        );
      }
      if (resumenConsulta.pacienteId !== odontograma.pacienteId.valor) {
        throw ConsultaInvalidaError.pacienteDiferente(
          consultaIdVo.valor,
          odontograma.pacienteId.valor,
          resumenConsulta.pacienteId
        );
      }
      if (resumenConsulta.estado !== 'EN_CURSO') {
        throw ConsultaInvalidaError.estadoNoPermitido(consultaIdVo.valor, resumenConsulta.estado);
      }
    }

    // 5. Validaciones y recuperación de contexto histórico para enmiendas
    let revisionCorregidaIdVo: RevisionId | null = null;
    let snapshotBaseHistorico: typeof odontograma.obtenerSnapshot | undefined = undefined;

    if (comando.tipoRevision === 'ENMIENDA_CORRECTIVA') {
      if (!comando.revisionCorregidaId) {
        throw new EnmiendaCorrectivaInvalidaError(
          'Toda enmienda correctiva debe referenciar obligatoriamente el identificador de la revisión corregida (revisionCorregidaId).'
        );
      }
      revisionCorregidaIdVo = RevisionId.reconstituir(comando.revisionCorregidaId);

      // Comprobar existencia y pertenencia de la revisión corregida en el repositorio
      const revisionCorregida = await this.odontogramaRepository.buscarRevisionPorId(revisionCorregidaIdVo);
      if (!revisionCorregida) {
        throw RevisionInvalidaError.noEncontrada(revisionCorregidaIdVo.valor);
      }
      if (!revisionCorregida.odontogramaId.equals(odontograma.id)) {
        throw RevisionInvalidaError.noPerteneceAlOdontograma(
          revisionCorregidaIdVo.valor,
          odontograma.id.valor,
          revisionCorregida.odontogramaId.valor
        );
      }

      // Si la enmienda NO aplica al estado actual, Application provee el snapshot de la revisión corregida
      const aplicaAlPresente = comando.aplicaAlEstadoActual ?? false;
      if (!aplicaAlPresente) {
        snapshotBaseHistorico = revisionCorregida.snapshotPiezas as any;
      }
    } else {
      // Si es NUEVA_OBSERVACION, no debe llevar referencia de corrección
      if (comando.revisionCorregidaId) {
        throw RevisionInvalidaError.referenciaInvalidaEnNuevaObservacion();
      }
    }

    // 6. Mapear deltas de la revisión hacia tipos de dominio
    const deltasDominio: DeltaPiezaOdontogramaProps[] = comando.deltas.map((d) => ({
      numeroFDI: d.numeroFDI,
      estadoAnatomicoAnterior: d.estadoAnatomicoAnterior as EstadoAnatomicoPieza | undefined,
      estadoAnatomicoNuevo: d.estadoAnatomicoNuevo as EstadoAnatomicoPieza | undefined,
      superficiesModificadas: d.superficiesModificadas?.map((s) => ({
        superficie: s.superficie as TipoSuperficie,
        condicionAnterior: s.condicionAnterior as CondicionSuperficie,
        condicionNueva: s.condicionNueva as CondicionSuperficie,
      })),
      tratamientoEstructuralAgregado: d.tratamientoEstructuralAgregado as TipoTratamientoEstructural | undefined,
      observaciones: d.observaciones,
    }));

    const fechaObservacion =
      comando.fechaObservacionClinica instanceof Date
        ? comando.fechaObservacionClinica
        : new Date(comando.fechaObservacionClinica);

    // 7. Ejecutar la operación de dominio en el Aggregate Root
    const nuevaRevision = odontograma.aplicarRevision({
      tipoRevision:
        comando.tipoRevision === 'ENMIENDA_CORRECTIVA'
          ? TipoRevisionOdontograma.ENMIENDA_CORRECTIVA
          : TipoRevisionOdontograma.NUEVA_OBSERVACION,
      revisionCorregidaId: revisionCorregidaIdVo,
      aplicaAlEstadoActual: comando.aplicaAlEstadoActual ?? (comando.tipoRevision === 'NUEVA_OBSERVACION'),
      snapshotBaseRevisionCorregida: snapshotBaseHistorico as any,
      consultaId: consultaIdVo,
      odontologoId,
      fechaObservacionClinica: fechaObservacion,
      motivoRevision: comando.motivoRevision,
      versionEsperada: comando.versionEsperada,
      deltas: deltasDominio,
    });

    // 8. Persistir de forma transaccional mediante el puerto
    await this.odontogramaRepository.aplicarRevisionTransaccional(
      odontograma,
      nuevaRevision,
      comando.versionEsperada
    );

    // 9. Retornar DTO de la revisión sellada
    return OdontogramaMapper.revisionToDto(nuevaRevision);
  }
}
