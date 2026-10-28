/**
 * Error lanzado cuando el servicio MS1 no está disponible o no responde
 * dentro de la ventana de timeout configurada, o ante fallos de red.
 */
export class PacienteNoDisponibleError extends Error {
  readonly codigo = 'MS1_PACIENTE_NO_DISPONIBLE';

  constructor(
    mensaje: string,
    public readonly causaOriginal?: unknown,
  ) {
    super(mensaje);
    this.name = 'PacienteNoDisponibleError';
  }
}

