import type { MedicamentoInputDto } from '../dtos/medicamento-input.dto.js';

export interface ActualizarMedicamentosCommand {
  /** Token del operador autenticado para auditoría. */
  tokenAutenticacion: string;
  /** Identificador de la historia clínica. */
  historiaClinicaId: string;
  /** Versión esperada para control de concurrencia optimista. */
  versionEsperada: number;
  /** Lista actualizada de medicamentos que el paciente toma actualmente. */
  medicamentos: MedicamentoInputDto[];
  /** Nota clínica opcional del profesional. */
  descripcion?: string | null;
}
