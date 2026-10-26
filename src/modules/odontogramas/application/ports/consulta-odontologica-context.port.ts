export interface ResumenConsultaParaOdontograma {
  existe: boolean;
  historiaClinicaId: string;
  pacienteId: string;
  estado: string; // 'EN_CURSO' | 'COMPLETADA' | 'CANCELADA'
}

/**
 * Puerto SPI para consultar la existencia, pertenencia y estado operativo de una Consulta Odontológica.
 */
export interface IConsultaOdontologicaContextPort {
  obtenerResumenConsulta(consultaId: string): Promise<ResumenConsultaParaOdontograma | null>;
}

export const CONSULTA_ODONTOLOGICA_CONTEXT_PORT = Symbol('IConsultaOdontologicaContextPort');
