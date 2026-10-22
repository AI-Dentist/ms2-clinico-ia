export interface ItemAlergiaSnapshot {
  sustancia: string;
  severidad: string;
}

export interface SnapshotRiesgoClinicoProps {
  alergiasCriticas?: ItemAlergiaSnapshot[];
  condicionesMedicas?: string[];
  medicacionHabitual?: string[];
  capturadoEn?: Date;
}

/**
 * Value Object inmutable que congela el estado de seguridad clínica del paciente al abrir la consulta.
 * Resuelve la trazabilidad médica ante cambios posteriores en la Historia Clínica longitudinal.
 */
export class SnapshotRiesgoClinico {
  private readonly _alergiasCriticas: ReadonlyArray<Readonly<ItemAlergiaSnapshot>>;
  private readonly _condicionesMedicas: ReadonlyArray<string>;
  private readonly _medicacionHabitual: ReadonlyArray<string>;
  private readonly _capturadoEn: Date;

  private constructor(props: SnapshotRiesgoClinicoProps) {
    const alergias = (props.alergiasCriticas ?? []).map((a) =>
      Object.freeze({ sustancia: a.sustancia.trim(), severidad: a.severidad.trim() })
    );
    const condiciones = (props.condicionesMedicas ?? []).map((c) => c.trim()).filter((c) => c.length > 0);
    const medicacion = (props.medicacionHabitual ?? []).map((m) => m.trim()).filter((m) => m.length > 0);

    this._alergiasCriticas = Object.freeze(alergias);
    this._condicionesMedicas = Object.freeze(condiciones);
    this._medicacionHabitual = Object.freeze(medicacion);
    this._capturadoEn = props.capturadoEn ? new Date(props.capturadoEn.getTime()) : new Date();

    Object.freeze(this);
  }

  static capturar(props: SnapshotRiesgoClinicoProps): SnapshotRiesgoClinico {
    return new SnapshotRiesgoClinico(props);
  }

  static reconstituir(props: SnapshotRiesgoClinicoProps): SnapshotRiesgoClinico {
    return new SnapshotRiesgoClinico(props);
  }

  static vacio(capturadoEn?: Date): SnapshotRiesgoClinico {
    return new SnapshotRiesgoClinico({
      alergiasCriticas: [],
      condicionesMedicas: [],
      medicacionHabitual: [],
      capturadoEn,
    });
  }

  get alergiasCriticas(): ReadonlyArray<Readonly<ItemAlergiaSnapshot>> {
    return this._alergiasCriticas;
  }

  get condicionesMedicas(): ReadonlyArray<string> {
    return this._condicionesMedicas;
  }

  get medicacionHabitual(): ReadonlyArray<string> {
    return this._medicacionHabitual;
  }

  get capturadoEn(): Date {
    return new Date(this._capturadoEn.getTime());
  }

  get tieneAlergiasRegistradas(): boolean {
    return this._alergiasCriticas.length > 0;
  }

  get tieneAlertasMedicas(): boolean {
    return this._alergiasCriticas.length > 0 || this._condicionesMedicas.length > 0;
  }
}
