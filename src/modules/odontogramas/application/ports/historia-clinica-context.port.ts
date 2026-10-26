export interface ResumenHistoriaClinicaParaOdontograma {
  existe: boolean;
  pacienteId: string;
  estado: string; // 'ACTIVA' | 'CERRADA' | 'ARCHIVADA'
}

/**
 * Puerto SPI para consultar la existencia, pertenencia del paciente y estado de la Historia Clínica
 * sin acoplar el módulo Odontograma al módulo Historias Clínicas.
 */
export interface IHistoriaClinicaContextPort {
  obtenerResumenHistoria(historiaClinicaId: string): Promise<ResumenHistoriaClinicaParaOdontograma | null>;
}

export const HISTORIA_CLINICA_CONTEXT_PORT = Symbol('IHistoriaClinicaContextPort');
