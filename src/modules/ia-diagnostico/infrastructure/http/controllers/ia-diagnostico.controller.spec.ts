import { describe, it, expect, beforeEach } from 'vitest';
import { IaDiagnosticoController } from './ia-diagnostico.controller.js';

describe('IaDiagnosticoController (S1: Retired Legacy CNN)', () => {
  let controller: IaDiagnosticoController;

  beforeEach(() => {
    controller = new IaDiagnosticoController();
  });

  it('debe responder HTTP 410 Gone con el payload exacto de retiro de modelo sin procesar imagenes', () => {
    const response = controller.analizarRadiografia();

    expect(response).toEqual({
      error: 'LEGACY_MODEL_RETIRED',
      detail: 'The untrained CNN endpoint was retired; use the trained detector.',
      replacement: '/api/expediente/estudios/analizar-imagen',
    });
  });
});
