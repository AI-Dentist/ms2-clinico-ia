export interface EliminarAlergiaCommand {
  /** Token del operador autenticado para auditoría. */
  tokenAutenticacion: string;
  /** Identificador de la historia clínica. */
  historiaClinicaId: string;
  /** Versión esperada para control de concurrencia optimista. */
  versionEsperada: number;
  /** Nombre o descripción de la sustancia alérgena a eliminar (case-insensitive). */
  sustancia: string;
  /** Nota clínica opcional del profesional explicando la remoción. */
  descripcion?: string | null;
}
