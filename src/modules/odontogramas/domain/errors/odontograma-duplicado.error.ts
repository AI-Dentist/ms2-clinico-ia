export class OdontogramaDuplicadoError extends Error {
  readonly codigo = 'ODONTOGRAMA_DUPLICADO';
  readonly historiaClinicaId: string;

  constructor(historiaClinicaId: string) {
    super(`Ya existe un odontograma registrado para la historia clínica '${historiaClinicaId}'.`);
    this.name = 'OdontogramaDuplicadoError';
    this.historiaClinicaId = historiaClinicaId;
  }
}
