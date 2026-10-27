export interface ResumenConsultaParaEstudio {
  existe: boolean;
  historiaClinicaId: string;
  pacienteId: string;
  estado: string;
  odontologoId: string;
}

export interface IConsultaContextPort {
  obtenerResumenConsulta(consultaId: string): Promise<ResumenConsultaParaEstudio | null>;
}

export const CONSULTA_CONTEXT_PORT = Symbol('IConsultaContextPort');
