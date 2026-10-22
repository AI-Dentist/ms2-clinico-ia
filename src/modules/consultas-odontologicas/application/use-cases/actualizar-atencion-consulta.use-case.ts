import { Inject, Injectable } from '@nestjs/common';
import {
  CONSULTA_ODONTOLOGICA_REPOSITORY,
  type IConsultaOdontologicaRepositoryPort,
} from '../../domain/ports/consulta-odontologica.repository.port.js';
import {
  ODONTOLOGO_CONTEXT_PORT,
  type IOdontologoContextPort,
} from '../../domain/ports/odontologo-context.port.js';
import { ConsultaId } from '../../domain/value-objects/consulta-id.vo.js';
import { OdontologoId } from '../../domain/value-objects/odontologo-id.vo.js';
import { MotivoConsulta } from '../../domain/value-objects/motivo-consulta.vo.js';
import { AnamnesisActual } from '../../domain/value-objects/anamnesis-actual.vo.js';
import { ExploracionFisica } from '../../domain/value-objects/exploracion-fisica.vo.js';
import { DiagnosticoItem } from '../../domain/value-objects/diagnostico-item.vo.js';
import { TipoDiagnostico } from '../../domain/value-objects/tipo-diagnostico.enum.js';
import { ProcedimientoRealizado } from '../../domain/value-objects/procedimiento-realizado.vo.js';
import { PiezaDentalFDI } from '../../domain/value-objects/pieza-dental-fdi.vo.js';
import { EvolucionSOAP } from '../../domain/value-objects/evolucion-soap.vo.js';
import { ConsultaNoEncontradaError } from '../../domain/errors/consulta-no-encontrada.error.js';
import { ConflictoConcurrenteConsultaError } from '../../domain/errors/conflicto-concurrente-consulta.error.js';
import { AutenticacionRequeridaError } from '../errors/autenticacion-requerida.error.js';
import { ConsultaOdontologicaMapper } from '../mappers/consulta-odontologica.mapper.js';
import type { ActualizarAtencionConsultaCommand } from '../commands/actualizar-atencion-consulta.command.js';
import type { ConsultaOdontologicaResponseDto } from '../dtos/consulta-odontologica-response.dto.js';
import type { ActualizarAtencionProps } from '../../domain/entities/consulta-odontologica.entity.js';

@Injectable()
export class ActualizarAtencionConsultaUseCase {
  constructor(
    @Inject(CONSULTA_ODONTOLOGICA_REPOSITORY)
    private readonly consultaRepository: IConsultaOdontologicaRepositoryPort,
    @Inject(ODONTOLOGO_CONTEXT_PORT)
    private readonly odontologoContextPort: IOdontologoContextPort
  ) {}

  async execute(
    command: ActualizarAtencionConsultaCommand,
    ahora: Date = new Date()
  ): Promise<ConsultaOdontologicaResponseDto> {
    if (!command.tokenAutenticacion?.trim()) {
      throw new AutenticacionRequeridaError(
        'Se requiere un token de autenticación válido para actualizar la atención clínica.'
      );
    }

    // 1. Resolver identidad autenticada
    const contexto = await this.odontologoContextPort.obtenerOdontologoActual(command.tokenAutenticacion);
    const odontologoId = OdontologoId.crear(contexto.odontologoId);

    // 2. Recuperar la consulta existente
    const consultaId = ConsultaId.reconstituir(command.consultaId);
    const consulta = await this.consultaRepository.buscarPorId(consultaId);
    if (!consulta) {
      throw new ConsultaNoEncontradaError(command.consultaId);
    }

    // 3. Verificación de versión para concurrencia optimista en memoria (INV-CONS-09)
    if (consulta.version !== command.versionEsperada) {
      throw new ConflictoConcurrenteConsultaError(command.consultaId, command.versionEsperada);
    }

    // 4. Preparar campos clínicos actualizados
    const propsActualizacion: ActualizarAtencionProps = {
      actualizadoPor: odontologoId,
    };

    if (command.motivoConsulta !== undefined) {
      propsActualizacion.motivoConsulta = MotivoConsulta.crear(command.motivoConsulta);
    }

    if (command.anamnesisActual !== undefined) {
      propsActualizacion.anamnesisActual = AnamnesisActual.crear({
        descripcion: command.anamnesisActual.descripcion ?? '',
        tiempoEvolucion: command.anamnesisActual.tiempoEvolucion,
        escalaDolorEVA: command.anamnesisActual.escalaDolorEVA,
      });
    }

    if (command.exploracionFisica !== undefined) {
      propsActualizacion.exploracionFisica = ExploracionFisica.crear({
        inspeccionExtraoral: command.exploracionFisica.inspeccionExtraoral,
        inspeccionIntraoral: command.exploracionFisica.inspeccionIntraoral,
        hallazgosDentales: command.exploracionFisica.hallazgosDentales,
      });
    }

    if (command.diagnosticos !== undefined) {
      propsActualizacion.diagnosticos = command.diagnosticos.map((d) =>
        DiagnosticoItem.crear({
          codigoCIE10: d.codigoCIE10,
          descripcion: d.descripcion,
          tipo: d.tipo as TipoDiagnostico,
        })
      );
    }

    if (command.procedimientosRealizados !== undefined) {
      propsActualizacion.procedimientosRealizados = command.procedimientosRealizados.map((p) =>
        ProcedimientoRealizado.crear({
          codigo: p.codigo,
          descripcion: p.descripcion,
          piezaDental:
            p.piezaDental !== undefined && p.piezaDental !== null
              ? PiezaDentalFDI.crear(p.piezaDental)
              : null,
          observaciones: p.observaciones,
        })
      );
    }

    if (command.evolucionSOAP !== undefined) {
      propsActualizacion.evolucionSOAP = EvolucionSOAP.crear(command.evolucionSOAP);
    }

    if (command.recomendaciones !== undefined) {
      propsActualizacion.recomendaciones = command.recomendaciones;
    }

    // 5. Aplicar mutación sobre el aggregate root (valida que esté EN_CURSO e incrementa versión)
    consulta.actualizarAtencion(propsActualizacion, ahora);

    // 6. Persistir con concurrencia optimista
    await this.consultaRepository.actualizar(consulta, command.versionEsperada);

    return ConsultaOdontologicaMapper.toResponseDto(consulta);
  }
}
