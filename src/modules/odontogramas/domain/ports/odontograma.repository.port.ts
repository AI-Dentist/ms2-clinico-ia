import type { Odontograma } from '../entities/odontograma.entity.js';
import type { RevisionOdontograma } from '../entities/revision-odontograma.entity.js';
import type { OdontogramaId } from '../value-objects/odontograma-id.vo.js';
import type { RevisionId } from '../value-objects/revision-id.vo.js';
import type { HistoriaClinicaId } from '../../../historias-clinicas/domain/value-objects/historia-clinica-id.vo.js';
import type { ConsultaId } from '../../../consultas-odontologicas/domain/value-objects/consulta-id.vo.js';

export interface ListadoRevisionesResultado {
  revisiones: RevisionOdontograma[];
  total: number;
}

/**
 * Puerto de repositorio (SPI) para la persistencia del agregado Odontograma y sus revisiones históricas.
 * Describe capacidades de persistencia sin acoplarse a Mongoose ni MongoDB.
 */
export interface IOdontogramaRepositoryPort {
  /**
   * Persiste atómicamente el nuevo odontograma maestro y su revisión basal número 1.
   */
  guardarInicial(
    odontograma: Odontograma,
    revisionBasal: RevisionOdontograma
  ): Promise<void>;

  /**
   * Persiste atómicamente el estado consolidado del odontograma (con versión esperada)
   * y la nueva revisión histórica en la colección de snapshots.
   * Lanza ConflictoConcurrenteOdontogramaError si la versión persistida no coincide con versionEsperada.
   */
  aplicarRevisionTransaccional(
    odontograma: Odontograma,
    nuevaRevision: RevisionOdontograma,
    versionEsperada: number
  ): Promise<void>;

  /**
   * Busca el odontograma consolidado por su ID canónico.
   */
  buscarPorId(id: OdontogramaId): Promise<Odontograma | null>;

  /**
   * Busca el odontograma consolidado vinculado a una historia clínica (relación 1:1).
   */
  buscarPorHistoriaClinicaId(historiaClinicaId: HistoriaClinicaId): Promise<Odontograma | null>;

  /**
   * Recupera una revisión histórica específica por su RevisionId.
   */
  buscarRevisionPorId(revisionId: RevisionId): Promise<RevisionOdontograma | null>;

  /**
   * Lista el historial cronológico paginado de revisiones de un odontograma.
   */
  listarRevisiones(
    odontogramaId: OdontogramaId,
    limite?: number,
    offset?: number
  ): Promise<ListadoRevisionesResultado>;

  /**
   * Lista todas las revisiones (ordenadas cronológicamente) asociadas a una consulta específica.
   * Permite múltiples revisiones por consulta.
   */
  listarRevisionesPorConsultaId(consultaId: ConsultaId): Promise<RevisionOdontograma[]>;
}

/**
 * Token de inyección de dependencias para el puerto del repositorio.
 */
export const ODONTOGRAMA_REPOSITORY = Symbol('IOdontogramaRepositoryPort');
