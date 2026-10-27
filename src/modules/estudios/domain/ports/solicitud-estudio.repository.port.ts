import type { SolicitudEstudio } from '../entities/solicitud-estudio.entity.js';

export interface ISolicitudEstudioRepositoryPort {
  guardar(solicitud: SolicitudEstudio): Promise<SolicitudEstudio>;
  buscarPorId(id: string): Promise<SolicitudEstudio | null>;
  listarPorConsulta(consultaId: string): Promise<SolicitudEstudio[]>;
  listarPorHistoriaClinica(historiaClinicaId: string): Promise<SolicitudEstudio[]>;
  contarPorLaboratorio(laboratorioId: string): Promise<number>;
}

export const SOLICITUD_ESTUDIO_REPOSITORY = Symbol('ISolicitudEstudioRepositoryPort');
