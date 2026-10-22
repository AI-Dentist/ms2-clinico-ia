import type { ConsultaOdontologica } from '../entities/consulta-odontologica.entity.js';
import type { ConsultaId } from '../value-objects/consulta-id.vo.js';
import type { HistoriaClinicaId } from '../value-objects/historia-clinica-id.vo.js';
import type { PacienteId } from '../value-objects/paciente-id.vo.js';
import type { CitaId } from '../value-objects/cita-id.vo.js';

export interface ListadoConsultasResultado {
  consultas: ConsultaOdontologica[];
  total: number;
}

/**
 * Puerto SPI del repositorio de persistencia para el agregado ConsultaOdontologica.
 */
export interface IConsultaOdontologicaRepositoryPort {
  /**
   * Guarda una nueva consulta en estado inicial EN_CURSO.
   */
  guardar(consulta: ConsultaOdontologica): Promise<void>;

  /**
   * Actualiza una consulta existente verificando la versión esperada (concurrencia optimista).
   * Lanza ConflictoConcurrenteConsultaError si la versión persistida no coincide con versionEsperada.
   */
  actualizar(consulta: ConsultaOdontologica, versionEsperada: number): Promise<void>;

  /**
   * Busca una consulta por su identificador único canónico.
   */
  buscarPorId(id: ConsultaId): Promise<ConsultaOdontologica | null>;

  /**
   * Busca si ya existe una consulta asociada a un citaId de MS3 (para verificar INV-CONS-07).
   */
  buscarPorCitaId(citaId: CitaId): Promise<ConsultaOdontologica | null>;

  /**
   * Lista consultas pertenecientes a un expediente ordenadas cronológicamente de forma descendente.
   */
  listarPorHistoriaClinica(
    historiaClinicaId: HistoriaClinicaId,
    limite?: number,
    offset?: number
  ): Promise<ListadoConsultasResultado>;

  /**
   * Lista consultas pertenecientes a un paciente ordenadas cronológicamente.
   */
  listarPorPacienteId(
    pacienteId: PacienteId,
    limite?: number,
    offset?: number
  ): Promise<ListadoConsultasResultado>;
}

/** Token de inyección de dependencias para IConsultaOdontologicaRepositoryPort. */
export const CONSULTA_ODONTOLOGICA_REPOSITORY = Symbol('IConsultaOdontologicaRepositoryPort');
