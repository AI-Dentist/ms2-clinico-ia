import type { EstadoHistoria } from '../../domain/value-objects/estado-historia.enum.js';

export interface CambiarEstadoHistoriaCommand {
  /** Token del operador autenticado para auditoría. */
  tokenAutenticacion: string;
  /** Identificador de la historia clínica. */
  historiaClinicaId: string;
  /** Versión esperada para control de concurrencia optimista. */
  versionEsperada: number;
  /** Nuevo estado destino (ACTIVA, CERRADA, ARCHIVADA). */
  nuevoEstado: EstadoHistoria;
  /** Justificación o motivo del cambio de estado. */
  descripcion?: string | null;
}
