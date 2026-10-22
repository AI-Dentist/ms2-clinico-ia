import type { AntecedentesInputDto } from '../dtos/antecedentes-input.dto.js';

export interface ActualizarAntecedentesCommand {
  /**
   * Token o credencial del profesional que realiza la modificación.
   * La aplicación resuelve la identidad a través de IOdontologoContextPort para la auditoría.
   */
  tokenAutenticacion: string;
  /** Identificador de la historia clínica. */
  historiaClinicaId: string;
  /**
   * Versión esperada del expediente al momento de la edición (control de concurrencia optimista).
   * Lanza ConflictoConcurrenteError si la versión en base de datos difiere.
   */
  versionEsperada: number;
  /** Nuevo estado de los antecedentes clínicos y odontológicos. */
  nuevosAntecedentes: AntecedentesInputDto;
  /** Rutas de campos modificados para el registro de auditoría (ej. ["antecedentes.enfermedadesCronicas"]). */
  camposModificados: string[];
  /** Nota clínica opcional del profesional explicando la modificación. */
  descripcion?: string | null;
}
