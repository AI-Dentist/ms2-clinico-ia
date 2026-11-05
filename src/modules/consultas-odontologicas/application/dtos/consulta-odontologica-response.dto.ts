export interface ItemAlergiaSnapshotDto {
  sustancia: string;
  severidad: string;
}

export interface SnapshotRiesgoClinicoDto {
  alergiasCriticas: ItemAlergiaSnapshotDto[];
  condicionesMedicas: string[];
  medicacionHabitual: string[];
  capturadoEn: string;
}

export interface AnamnesisActualDto {
  descripcion: string;
  tiempoEvolucion: string | null;
  escalaDolorEVA: number | null;
}

export interface ExploracionFisicaDto {
  inspeccionExtraoral: string | null;
  inspeccionIntraoral: string;
  hallazgosDentales: string | null;
}

export interface DiagnosticoItemDto {
  codigoCIE10: string | null;
  descripcion: string;
  tipo: string;
}

export interface ProcedimientoRealizadoDto {
  codigo: string | null;
  descripcion: string;
  piezaDental: number | null;
  observaciones: string | null;
}

export interface ServicioFacturableResponseDto {
  servicioId: string;
  codigo: string | null;
  nombre: string;
  cantidad: number;
  precioUnitarioBs: string;
  subtotalBs: string;
  piezaDental: number | null;
}

export interface EvolucionSOAPDto {
  subjetivo: string | null;
  objetivo: string | null;
  analisis: string | null;
  plan: string | null;
}

export interface RechazoFacturacionDto {
  motivoCodigo: string;
  motivo: string;
  rechazadaEn: string;
}

/**
 * Data Transfer Object que representa la respuesta completa e inmutable
 * de una consulta odontológica hacia los clientes y capas externas.
 */
export interface ConsultaOdontologicaResponseDto {
  id: string;
  historiaClinicaId: string;
  pacienteId: string;
  odontologoId: string;
  citaId: string | null;
  versionHistoriaReferenciada: number;
  snapshotRiesgoClinico: SnapshotRiesgoClinicoDto;
  fechaAtencion: string;
  cerradaEn: string | null;
  estado: string;
  motivoConsulta: string;
  anamnesisActual: AnamnesisActualDto;
  exploracionFisica: ExploracionFisicaDto;
  diagnosticos: DiagnosticoItemDto[];
  procedimientosRealizados: ProcedimientoRealizadoDto[];
  serviciosFacturables: ServicioFacturableResponseDto[];
  observacionesCobro: string | null;
  totalFacturableBs: string;
  evolucionSOAP: EvolucionSOAPDto;
  recomendaciones: string | null;
  motivoCancelacion: string | null;
  rechazoFacturacion: RechazoFacturacionDto | null;
  version: number;
  creadoEn: string;
  actualizadoEn: string;
  creadoPor: string;
  actualizadoPor: string;
}
