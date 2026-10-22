import type { AntecedentesInputDto } from '../dtos/antecedentes-input.dto.js';

export interface CrearHistoriaClinicaCommand {
  /**
   * Token o credencial de autenticación confiable del operador que ejecuta la apertura.
   * La aplicación resuelve la identidad a través de IOdontologoContextPort.
   */
  tokenAutenticacion: string;
  /** Identificador canónico del paciente (validado contra MS1). */
  pacienteId: string;
  /**
   * Identificador opcional del odontólogo asignado como responsable clínico.
   * Si se omite, se asigna al odontólogo autenticado que ejecuta la creación.
   */
  odontologoResponsableId?: string;
  /** Antecedentes iniciales opcionales. Si se omiten, inician en NO_EVALUADO. */
  antecedentes?: AntecedentesInputDto;
  /** Observaciones generales iniciales. */
  observacionesGenerales?: string | null;
}
