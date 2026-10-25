import { PiezaDentalFDI } from '../../../consultas-odontologicas/domain/value-objects/pieza-dental-fdi.vo.js';
import { ConsultaId } from '../../../consultas-odontologicas/domain/value-objects/consulta-id.vo.js';
import { EstadoAnatomicoPieza } from '../value-objects/estado-anatomico-pieza.enum.js';
import { EstadoEvaluacionPieza } from '../value-objects/estado-evaluacion-pieza.enum.js';
import { TipoSuperficie } from '../value-objects/tipo-superficie.enum.js';
import { CondicionSuperficie } from '../value-objects/condicion-superficie.enum.js';
import { SuperficieDental } from '../value-objects/superficie-dental.vo.js';
import { TratamientoEstructural } from '../value-objects/tratamiento-estructural.vo.js';
import { TipoTratamientoEstructural } from '../value-objects/tipo-tratamiento-estructural.enum.js';
import { EstadoAnatomicoIncompatibleError } from '../errors/estado-anatomico-incompatible.error.js';
import { SuperficieIncisalIncompatibleError } from '../errors/superficie-incisal-incompatible.error.js';

export interface PiezaDentalSnapshotProps {
  numeroFDI: number;
  estadoAnatomico: EstadoAnatomicoPieza;
  estadoEvaluacion: EstadoEvaluacionPieza;
  superficies: Readonly<Record<TipoSuperficie, { superficie: TipoSuperficie; condicion: CondicionSuperficie; evaluada: boolean }>>;
  tratamientosEstructurales: ReadonlyArray<{ tipo: TipoTratamientoEstructural; consultaId: string | null; fechaRegistro: Date }>;
  observaciones: string | null;
}

export interface ReconstituirPiezaProps {
  numeroFDI: PiezaDentalFDI;
  estadoAnatomico: EstadoAnatomicoPieza;
  estadoEvaluacion: EstadoEvaluacionPieza;
  superficies: Map<TipoSuperficie, SuperficieDental>;
  tratamientosEstructurales: TratamientoEstructural[];
  observaciones: string | null;
}

const TODAS_LAS_SUPERFICIES: ReadonlyArray<TipoSuperficie> = [
  TipoSuperficie.VESTIBULAR,
  TipoSuperficie.PALATINA_LINGUAL,
  TipoSuperficie.MESIAL,
  TipoSuperficie.DISTAL,
  TipoSuperficie.OCLUSAL_INCISAL,
];

/**
 * Entidad interna que gestiona el estado clínico y anatómico de una posición FDI.
 */
export class PiezaDentalOdontograma {
  private readonly _numeroFDI: PiezaDentalFDI;
  private _estadoAnatomico: EstadoAnatomicoPieza;
  private _estadoEvaluacion: EstadoEvaluacionPieza;
  private readonly _superficies: Map<TipoSuperficie, SuperficieDental>;
  private _tratamientosEstructurales: TratamientoEstructural[];
  private _observaciones: string | null;

  private constructor(props: ReconstituirPiezaProps) {
    this._numeroFDI = props.numeroFDI;
    this._estadoAnatomico = props.estadoAnatomico;
    this._estadoEvaluacion = props.estadoEvaluacion;
    this._superficies = new Map(props.superficies);
    this._tratamientosEstructurales = [...props.tratamientosEstructurales];
    this._observaciones = props.observaciones?.trim() || null;
  }

  /**
   * Fábrica: Inicializa la pieza en estado estrictamente neutro y no evaluado (INV-ODO-01).
   * Estado anatómico: DESCONOCIDO.
   * Estado de evaluación: NO_EVALUADO.
   * Superficies: NO_EVALUADA (evaluada = false).
   */
  static crearInicial(numeroFDI: PiezaDentalFDI): PiezaDentalOdontograma {
    const superficies = new Map<TipoSuperficie, SuperficieDental>();
    for (const sup of TODAS_LAS_SUPERFICIES) {
      superficies.set(sup, SuperficieDental.crearNoEvaluada(sup));
    }

    return new PiezaDentalOdontograma({
      numeroFDI,
      estadoAnatomico: EstadoAnatomicoPieza.DESCONOCIDO,
      estadoEvaluacion: EstadoEvaluacionPieza.NO_EVALUADO,
      superficies,
      tratamientosEstructurales: [],
      observaciones: null,
    });
  }

  static reconstituir(props: ReconstituirPiezaProps): PiezaDentalOdontograma {
    return new PiezaDentalOdontograma(props);
  }

  /**
   * Reconstituye una pieza dental a partir de un snapshot inmutable histórico.
   */
  static desdeSnapshot(snapshot: PiezaDentalSnapshotProps): PiezaDentalOdontograma {
    const fdiVo = PiezaDentalFDI.crear(snapshot.numeroFDI);
    const superficiesMap = new Map<TipoSuperficie, SuperficieDental>();

    for (const supKey of Object.keys(snapshot.superficies) as TipoSuperficie[]) {
      const supData = snapshot.superficies[supKey];
      superficiesMap.set(supKey, SuperficieDental.reconstituir(supData));
    }

    const tratamientos = (snapshot.tratamientosEstructurales ?? []).map((t) =>
      TratamientoEstructural.reconstituir({
        tipo: t.tipo,
        consultaId: t.consultaId ? ConsultaId.reconstituir(t.consultaId) : null,
        fechaRegistro: new Date(t.fechaRegistro),
      })
    );

    return new PiezaDentalOdontograma({
      numeroFDI: fdiVo,
      estadoAnatomico: snapshot.estadoAnatomico,
      estadoEvaluacion: snapshot.estadoEvaluacion,
      superficies: superficiesMap,
      tratamientosEstructurales: tratamientos,
      observaciones: snapshot.observaciones,
    });
  }

  get numeroFDI(): PiezaDentalFDI {
    return this._numeroFDI;
  }

  get estadoAnatomico(): EstadoAnatomicoPieza {
    return this._estadoAnatomico;
  }

  get estadoEvaluacion(): EstadoEvaluacionPieza {
    return this._estadoEvaluacion;
  }

  get superficies(): ReadonlyMap<TipoSuperficie, SuperficieDental> {
    return new Map(this._superficies); // Copia defensiva de la colección
  }

  get tratamientosEstructurales(): ReadonlyArray<TratamientoEstructural> {
    return Object.freeze([...this._tratamientosEstructurales]);
  }

  get observaciones(): string | null {
    return this._observaciones;
  }

  /**
   * Indica si la pieza corresponde a un diente anterior (incisivo central, lateral o canino).
   */
  get esAnterior(): boolean {
    return this._numeroFDI.posicion <= 3;
  }

  /**
   * Modifica el estado anatómico de la pieza (INV-ODO-01, INV-ODO-02).
   */
  actualizarEstadoAnatomico(nuevoEstado: EstadoAnatomicoPieza): void {
    if (this._estadoAnatomico === nuevoEstado) return;

    this._estadoAnatomico = nuevoEstado;
    this._estadoEvaluacion = EstadoEvaluacionPieza.EVALUADO;

    // Si la pieza deja de estar PRESENTE (ej. exodoncia a EXTRAIDO o confirmación de AUSENTE),
    // sus superficies activas en la proyección vigente no pueden manifestar caries o restauraciones activas.
    if (nuevoEstado !== EstadoAnatomicoPieza.PRESENTE) {
      for (const sup of TODAS_LAS_SUPERFICIES) {
        this._superficies.set(sup, SuperficieDental.crearNoEvaluada(sup));
      }
    }
  }

  /**
   * Asigna una condición clínica a una superficie dental validando las invariantes anatómicas (INV-ODO-02, INV-ODO-03, INV-ODO-04).
   */
  establecerCondicionSuperficie(superficie: TipoSuperficie, condicion: CondicionSuperficie): void {
    // INV-ODO-02: Solo piezas con estado anatómico PRESENTE admiten lesiones o restauraciones de superficie
    const condicionRequierePresencia =
      condicion === CondicionSuperficie.CARIES ||
      condicion === CondicionSuperficie.OBTURACION_RESINA ||
      condicion === CondicionSuperficie.OBTURACION_AMALGAMA ||
      condicion === CondicionSuperficie.FRACTURA ||
      condicion === CondicionSuperficie.SELLANTE ||
      condicion === CondicionSuperficie.SANA;

    if (condicionRequierePresencia && this._estadoAnatomico !== EstadoAnatomicoPieza.PRESENTE) {
      throw new EstadoAnatomicoIncompatibleError(this._numeroFDI.valor, this._estadoAnatomico, condicion);
    }

    // INV-ODO-04: Borde incisal de piezas anteriores no admite sellantes de fisuras
    if (this.esAnterior && superficie === TipoSuperficie.OCLUSAL_INCISAL && condicion === CondicionSuperficie.SELLANTE) {
      throw new SuperficieIncisalIncompatibleError(this._numeroFDI.valor);
    }

    this._superficies.set(superficie, SuperficieDental.crear(superficie, condicion));
    this._estadoEvaluacion = EstadoEvaluacionPieza.EVALUADO;
  }

  /**
   * Registra un tratamiento estructural completo en la pieza.
   */
  agregarTratamientoEstructural(tratamiento: TratamientoEstructural): void {
    if (
      this._estadoAnatomico !== EstadoAnatomicoPieza.PRESENTE &&
      tratamiento.tipo !== TipoTratamientoEstructural.IMPLANTE
    ) {
      throw new EstadoAnatomicoIncompatibleError(
        this._numeroFDI.valor,
        this._estadoAnatomico,
        CondicionSuperficie.SANA
      );
    }

    // Evitar agregar tratamientos idénticos duplicados
    const yaExiste = this._tratamientosEstructurales.some(
      (t) => t.tipo === tratamiento.tipo && t.fechaRegistro.getTime() === tratamiento.fechaRegistro.getTime()
    );
    if (!yaExiste) {
      this._tratamientosEstructurales.push(tratamiento);
    }
    this._estadoEvaluacion = EstadoEvaluacionPieza.EVALUADO;
  }

  /**
   * Actualiza las notas u observaciones cualitativas de la pieza.
   */
  actualizarObservaciones(texto: string | null): void {
    this._observaciones = texto?.trim() || null;
    this._estadoEvaluacion = EstadoEvaluacionPieza.EVALUADO;
  }

  /**
   * Produce una copia profunda e independiente de la entidad.
   */
  clonar(): PiezaDentalOdontograma {
    const superficiesClonadas = new Map<TipoSuperficie, SuperficieDental>();
    for (const [sup, val] of this._superficies.entries()) {
      superficiesClonadas.set(sup, SuperficieDental.reconstituir(val.toObject()));
    }

    return new PiezaDentalOdontograma({
      numeroFDI: this._numeroFDI,
      estadoAnatomico: this._estadoAnatomico,
      estadoEvaluacion: this._estadoEvaluacion,
      superficies: superficiesClonadas,
      tratamientosEstructurales: this._tratamientosEstructurales.map((t) =>
        TratamientoEstructural.reconstituir({
          tipo: t.tipo,
          consultaId: t.consultaId,
          fechaRegistro: t.fechaRegistro,
        })
      ),
      observaciones: this._observaciones,
    });
  }

  /**
   * Genera un snapshot inmutable para ser almacenado en una revisión histórica.
   */
  toSnapshot(): PiezaDentalSnapshotProps {
    const superficiesObj = {} as Record<
      TipoSuperficie,
      { superficie: TipoSuperficie; condicion: CondicionSuperficie; evaluada: boolean }
    >;

    for (const [sup, val] of this._superficies.entries()) {
      superficiesObj[sup] = Object.freeze(val.toObject());
    }

    const tratamientos = this._tratamientosEstructurales.map((t) => Object.freeze(t.toObject()));

    return Object.freeze({
      numeroFDI: this._numeroFDI.valor,
      estadoAnatomico: this._estadoAnatomico,
      estadoEvaluacion: this._estadoEvaluacion,
      superficies: Object.freeze(superficiesObj),
      tratamientosEstructurales: Object.freeze(tratamientos),
      observaciones: this._observaciones,
    });
  }
}
