/**
 * Resumen clínico del expediente para la apertura y congelación de snapshot de riesgo.
 */
export interface ResumenHistoriaClinicaParaApertura {
  existe: boolean;
  pacienteId: string;
  estado: string; // 'ACTIVA' | 'CERRADA' | 'ARCHIVADA'
  versionActual: number;
  alergiasCriticas: Array<{ sustancia: string; severidad: string }>;
  condicionesMedicas: string[];
  medicacionHabitual: string[];
}

/**
 * Puerto SPI para consultar el estado y antecedentes de Historia Clínica desde el dominio de Consultas.
 */
export interface IHistoriaClinicaContextPort {
  obtenerResumenParaApertura(historiaClinicaId: string): Promise<ResumenHistoriaClinicaParaApertura | null>;
}
