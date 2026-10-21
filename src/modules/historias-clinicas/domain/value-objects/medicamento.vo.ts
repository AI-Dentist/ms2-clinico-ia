export interface PropsMedicamento {
  nombre: string;
  principioActivo: string | null;
  dosis: string;
  motivoUso: string | null;
  prescritoDesde: Date | null;
}

/**
 * Value object que representa un medicamento que el paciente toma actualmente.
 * El listado de medicamentos actuales se reemplaza en cada actualización;
 * no es un historial de medicamentos pasados.
 */
export class Medicamento {
  readonly nombre: string;
  readonly principioActivo: string | null;
  readonly dosis: string;
  readonly motivoUso: string | null;
  readonly prescritoDesde: Date | null;

  private constructor(props: PropsMedicamento) {
    const nombre = props.nombre?.trim();
    if (!nombre) {
      throw new Error("Medicamento: 'nombre' es obligatorio y no puede estar vacío.");
    }
    const dosis = props.dosis?.trim();
    if (!dosis) {
      throw new Error("Medicamento: 'dosis' es obligatoria y no puede estar vacía.");
    }

    this.nombre = nombre;
    this.principioActivo = props.principioActivo?.trim() ?? null;
    this.dosis = dosis;
    this.motivoUso = props.motivoUso?.trim() ?? null;
    this.prescritoDesde = props.prescritoDesde ?? null;
  }

  static crear(props: PropsMedicamento): Medicamento {
    return new Medicamento(props);
  }
}
