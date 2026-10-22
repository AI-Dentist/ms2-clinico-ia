import type { AlergiaInputDto } from '../dtos/alergia-input.dto.js';

export interface AgregarAlergiaCommand {
  /** Token del operador autenticado para auditoría. */
  tokenAutenticacion: string;
  /** Identificador de la historia clínica. */
  historiaClinicaId: string;
  /** Versión esperada para control de concurrencia optimista. */
  versionEsperada: number;
  /** Datos de la alergia a registrar. */
  alergia: AlergiaInputDto;
  /** Nota clínica opcional del profesional. */
  descripcion?: string | null;
}
