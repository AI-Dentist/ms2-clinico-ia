import { describe, it, expect, vi, beforeEach } from 'vitest';
import { LocalHistoriaClinicaContextAdapter } from './local-historia-clinica-context.adapter.js';
import { HistoriaClinicaId } from '../../../historias-clinicas/domain/value-objects/historia-clinica-id.vo.js';
import { PacienteId } from '../../../historias-clinicas/domain/value-objects/paciente-id.vo.js';

describe('LocalHistoriaClinicaContextAdapter (Unit Tests)', () => {
  let adapter: LocalHistoriaClinicaContextAdapter;
  let buscarPorIdMock: any;
  let mockHistoriaRepo: any;

  const historiaIdStr = 'hc_12345678-1234-1234-1234-123456789abc';
  const pacienteIdStr = 'pac_87654321-4321-4321-4321-abcdef123456';

  beforeEach(() => {
    buscarPorIdMock = vi.fn();
    mockHistoriaRepo = {
      buscarPorId: buscarPorIdMock,
      guardar: vi.fn(),
      buscarPorPacienteId: vi.fn(),
      existePorPacienteId: vi.fn(),
      actualizar: vi.fn(),
    };
    adapter = new LocalHistoriaClinicaContextAdapter(mockHistoriaRepo);
  });

  it('debe retornar resumen con existe=true cuando la historia clínica existe', async () => {
    const mockHistoria: any = {
      id: HistoriaClinicaId.reconstituir(historiaIdStr),
      pacienteId: PacienteId.crear(pacienteIdStr),
      estado: 'ACTIVA',
    };
    buscarPorIdMock.mockResolvedValueOnce(mockHistoria);

    const resultado = await adapter.obtenerResumenHistoria(historiaIdStr);

    expect(resultado).toEqual({
      existe: true,
      pacienteId: pacienteIdStr,
      estado: 'ACTIVA',
    });
    expect(buscarPorIdMock).toHaveBeenCalledTimes(1);
  });

  it('debe retornar null cuando la historia clínica no existe', async () => {
    buscarPorIdMock.mockResolvedValueOnce(null);

    const resultado = await adapter.obtenerResumenHistoria(historiaIdStr);

    expect(resultado).toBeNull();
  });

  it('debe retornar null sin lanzar error si el id de historia clínica está vacío o es inválido', async () => {
    const resultado = await adapter.obtenerResumenHistoria('');

    expect(resultado).toBeNull();
    expect(buscarPorIdMock).not.toHaveBeenCalled();
  });
});
