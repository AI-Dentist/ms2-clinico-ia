import type { HistoriaClinica } from '../entities/historia-clinica.entity.js';
import type { HistoriaClinicaId } from '../value-objects/historia-clinica-id.vo.js';
import type { PacienteId } from '../value-objects/paciente-id.vo.js';

/**
 * Puerto de salida (output port) para la persistencia de HistoriaClinica.
 * La implementación concreta vive en infrastructure/persistence/.
 * El dominio solo conoce esta interfaz.
 *
 * Contrato:
 * - actualizar() lanza ConflictoConcurrenteError si versionEsperada no coincide
 *   con la versión actual en la base de datos.
 */
export interface IHistoriaClinicaRepository {
  guardar(historia: HistoriaClinica): Promise<void>;
  buscarPorId(id: HistoriaClinicaId): Promise<HistoriaClinica | null>;
  buscarPorPacienteId(pacienteId: PacienteId): Promise<HistoriaClinica | null>;
  existePorPacienteId(pacienteId: PacienteId): Promise<boolean>;
  /** @throws ConflictoConcurrenteError si versionEsperada no coincide. */
  actualizar(historia: HistoriaClinica, versionEsperada: number): Promise<HistoriaClinica>;
}

/** Token de inyección de dependencias para IHistoriaClinicaRepository. */
export const HISTORIA_CLINICA_REPOSITORY = Symbol('IHistoriaClinicaRepository');
