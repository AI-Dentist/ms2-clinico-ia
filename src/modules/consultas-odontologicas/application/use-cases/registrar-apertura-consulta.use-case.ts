import { Inject, Injectable } from '@nestjs/common';
import {
  CONSULTA_ODONTOLOGICA_REPOSITORY,
  type IConsultaOdontologicaRepositoryPort,
} from '../../domain/ports/consulta-odontologica.repository.port.js';
import {
  HISTORIA_CLINICA_CONTEXT_PORT,
  type IHistoriaClinicaContextPort,
} from '../../domain/ports/historia-clinica-context.port.js';
import {
  CITA_VALIDATOR_PORT,
  type ICitaValidatorPort,
} from '../../domain/ports/cita-validator.port.js';
import {
  ODONTOLOGO_CONTEXT_PORT,
  type IOdontologoContextPort,
} from '../../domain/ports/odontologo-context.port.js';
import { ConsultaOdontologica } from '../../domain/entities/consulta-odontologica.entity.js';
import { HistoriaClinicaId } from '../../domain/value-objects/historia-clinica-id.vo.js';
import { PacienteId } from '../../domain/value-objects/paciente-id.vo.js';
import { OdontologoId } from '../../domain/value-objects/odontologo-id.vo.js';
import { CitaId } from '../../domain/value-objects/cita-id.vo.js';
import { MotivoConsulta } from '../../domain/value-objects/motivo-consulta.vo.js';
import { AnamnesisActual } from '../../domain/value-objects/anamnesis-actual.vo.js';
import { ExploracionFisica } from '../../domain/value-objects/exploracion-fisica.vo.js';
import { DiagnosticoItem } from '../../domain/value-objects/diagnostico-item.vo.js';
import { TipoDiagnostico } from '../../domain/value-objects/tipo-diagnostico.enum.js';
import { ProcedimientoRealizado } from '../../domain/value-objects/procedimiento-realizado.vo.js';
import { PiezaDentalFDI } from '../../domain/value-objects/pieza-dental-fdi.vo.js';
import { EvolucionSOAP } from '../../domain/value-objects/evolucion-soap.vo.js';
import { SnapshotRiesgoClinico } from '../../domain/value-objects/snapshot-riesgo-clinico.vo.js';
import { HistoriaClinicaNoHabilitadaError } from '../../domain/errors/historia-clinica-no-habilitada.error.js';
import { CitaInvalidaParaConsultaError } from '../../domain/errors/cita-invalida-para-consulta.error.js';
import { AutenticacionRequeridaError } from '../errors/autenticacion-requerida.error.js';
import { PacienteNoCoincideError } from '../errors/paciente-no-coincide.error.js';
import { ConsultaOdontologicaMapper } from '../mappers/consulta-odontologica.mapper.js';
import type { RegistrarAperturaConsultaCommand } from '../commands/registrar-apertura-consulta.command.js';
import type { ConsultaOdontologicaResponseDto } from '../dtos/consulta-odontologica-response.dto.js';

@Injectable()
export class RegistrarAperturaConsultaUseCase {
  constructor(
    @Inject(CONSULTA_ODONTOLOGICA_REPOSITORY)
    private readonly consultaRepository: IConsultaOdontologicaRepositoryPort,
    @Inject(HISTORIA_CLINICA_CONTEXT_PORT)
    private readonly historiaClinicaContextPort: IHistoriaClinicaContextPort,
    @Inject(CITA_VALIDATOR_PORT)
    private readonly citaValidatorPort: ICitaValidatorPort,
    @Inject(ODONTOLOGO_CONTEXT_PORT)
    private readonly odontologoContextPort: IOdontologoContextPort
  ) {}

  async execute(
    command: RegistrarAperturaConsultaCommand,
    ahora: Date = new Date()
  ): Promise<ConsultaOdontologicaResponseDto> {
    if (!command.tokenAutenticacion?.trim()) {
      throw new AutenticacionRequeridaError(
        'Se requiere un token de autenticación válido para registrar la apertura de la consulta.'
      );
    }

    // 1. Resolver identidad autenticada del odontólogo tratante (no confiamos en identificadores arbitrarios del cliente)
    const contextoOperador = await this.odontologoContextPort.obtenerOdontologoActual(
      command.tokenAutenticacion
    );
    const odontologoId = OdontologoId.crear(contextoOperador.odontologoId);

    // 2. Validar existencia y aptitud de la Historia Clínica (INV-CONS-02)
    const resumenHistoria = await this.historiaClinicaContextPort.obtenerResumenParaApertura(
      command.historiaClinicaId
    );
    if (!resumenHistoria || !resumenHistoria.existe) {
      throw new HistoriaClinicaNoHabilitadaError(command.historiaClinicaId);
    }
    if (resumenHistoria.estado !== 'ACTIVA') {
      throw new HistoriaClinicaNoHabilitadaError(command.historiaClinicaId, resumenHistoria.estado);
    }

    // 3. Validar coincidencia de titularidad del paciente
    if (resumenHistoria.pacienteId !== command.pacienteId) {
      throw new PacienteNoCoincideError(resumenHistoria.pacienteId, command.pacienteId);
    }

    // 4. Validar CitaId opcional (INV-CONS-07)
    let citaIdVo: CitaId | null = null;
    if (command.citaId?.trim()) {
      citaIdVo = CitaId.crear(command.citaId);

      // Comprobar que no esté ya asociada a otra consulta en el repositorio local
      // NOTA ARQUITECTÓNICA: En la Iteración 6D se implementará un índice único parcial en MongoDB
      // ({ citaId: 1 }, { unique: true, partialFilterExpression: { citaId: { $type: "string" } } })
      // para blindar carreras de concurrencia simultáneas entre peticiones paralelas.
      const consultaConCita = await this.consultaRepository.buscarPorCitaId(citaIdVo);
      if (consultaConCita) {
        throw new CitaInvalidaParaConsultaError(
          command.citaId,
          'La cita ya se encuentra asociada a otra consulta odontológica activa.'
        );
      }

      // Validar contrato con MS3
      const validacionCita = await this.citaValidatorPort.validarCitaParaAtencion(
        command.citaId,
        command.pacienteId
      );
      if (!validacionCita.esValida) {
        throw new CitaInvalidaParaConsultaError(
          command.citaId,
          validacionCita.motivoInvalidez ?? 'La cita no es válida para la atención del paciente.'
        );
      }
    }

    // 5. Congelar SnapshotRiesgoClinico inmutable con datos de la Historia Clínica activa
    const snapshotRiesgoClinico = SnapshotRiesgoClinico.capturar({
      alergiasCriticas: resumenHistoria.alergiasCriticas,
      condicionesMedicas: resumenHistoria.condicionesMedicas,
      medicacionHabitual: resumenHistoria.medicacionHabitual,
      capturadoEn: ahora,
    });

    // 6. Construir Value Objects clínicos opcionales si fueron provistos
    const motivoConsulta = MotivoConsulta.crear(command.motivoConsulta);
    const anamnesisActual = command.anamnesisActual
      ? AnamnesisActual.crear({
          descripcion: command.anamnesisActual.descripcion ?? '',
          tiempoEvolucion: command.anamnesisActual.tiempoEvolucion,
          escalaDolorEVA: command.anamnesisActual.escalaDolorEVA,
        })
      : AnamnesisActual.vacia();

    const exploracionFisica = command.exploracionFisica
      ? ExploracionFisica.crear({
          inspeccionExtraoral: command.exploracionFisica.inspeccionExtraoral,
          inspeccionIntraoral: command.exploracionFisica.inspeccionIntraoral,
          hallazgosDentales: command.exploracionFisica.hallazgosDentales,
        })
      : ExploracionFisica.vacia();

    const diagnosticos = (command.diagnosticos ?? []).map((d) =>
      DiagnosticoItem.crear({
        codigoCIE10: d.codigoCIE10,
        descripcion: d.descripcion,
        tipo: d.tipo as TipoDiagnostico,
      })
    );

    const procedimientosRealizados = (command.procedimientosRealizados ?? []).map((p) =>
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

    const evolucionSOAP = command.evolucionSOAP
      ? EvolucionSOAP.crear(command.evolucionSOAP)
      : EvolucionSOAP.vacia();

    // 7. Abrir la consulta mediante la factoría de la Entidad Raíz
    const consulta = ConsultaOdontologica.abrir(
      {
        historiaClinicaId: HistoriaClinicaId.crear(command.historiaClinicaId),
        pacienteId: PacienteId.crear(command.pacienteId),
        odontologoId,
        citaId: citaIdVo,
        versionHistoriaReferenciada: resumenHistoria.versionActual,
        snapshotRiesgoClinico,
        fechaAtencion: command.fechaAtencion ?? ahora,
        motivoConsulta,
        anamnesisActual,
        exploracionFisica,
        diagnosticos,
        procedimientosRealizados,
        evolucionSOAP,
        recomendaciones: command.recomendaciones,
      },
      ahora
    );

    // 8. Persistir
    await this.consultaRepository.guardar(consulta);

    return ConsultaOdontologicaMapper.toResponseDto(consulta);
  }
}
