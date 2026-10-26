import { describe, it, expect, vi, beforeEach } from 'vitest';
import { LocalConsultaOdontologicaContextAdapter } from './local-consulta-odontologica-context.adapter.js';
import { ConsultaId } from '../../../consultas-odontologicas/domain/value-objects/consulta-id.vo.js';
import { HistoriaClinicaId } from '../../../historias-clinicas/domain/value-objects/historia-clinica-id.vo.js';
import { PacienteId } from '../../../historias-clinicas/domain/value-objects/paciente-id.vo.js';

describe('LocalConsultaOdontologicaContextAdapter (Unit Tests)', () => {
  let adapter: LocalConsultaOdontologicaContextAdapter;
  let buscarPorIdMock: any;
  let mockConsultaRepo: any;

  const consultaIdStr = 'cons_12345678-1234-1234-1234-123456789abc';
  const historiaIdStr = 'hc_12345678-1234-1234-1234-123456789abc';
  const pacienteIdStr = 'pac_87654321-4321-4321-4321-abcdef123456';

  beforeEach(() => {
    buscarPorIdMock = vi.fn();
    mockConsultaRepo = {
      buscarPorId: buscarPorIdMock,
      guardar: vi.fn(),
      actualizar: vi.fn(),
      buscarPorCitaId: vi.fn(),
      listarPorHistoriaClinica: vi.fn(),
      listarPorPacienteId: vi.fn(),
    };
    adapter = new LocalConsultaOdontologicaContextAdapter(mockConsultaRepo);
  });

  it('debe retornar resumen de consulta cuando existe y pertenece a la historia/paciente', async () => {
    const mockConsulta: any = {
      id: ConsultaId.reconstituir(consultaIdStr),
      historiaClinicaId: HistoriaClinicaId.reconstituir(historiaIdStr),
      pacienteId: PacienteId.crear(pacienteIdStr),
      estado: 'EN_CURSO',
    };
    buscarPorIdMock.mockResolvedValueOnce(mockConsulta);

    const resultado = await adapter.obtenerResumenConsulta(consultaIdStr);

    expect(resultado).toEqual({
      existe: true,
      historiaClinicaId: historiaIdStr,
      pacienteId: pacienteIdStr,
      estado: 'EN_CURSO',
    });
    expect(buscarPorIdMock).toHaveBeenCalledTimes(1);
  });

  it('debe retornar null cuando la consulta no existe', async () => {
    buscarPorIdMock.mockResolvedValueOnce(null);

    const resultado = await adapter.obtenerResumenConsulta(consultaIdStr);

    expect(resultado).toBeNull();
  });

  it('debe retornar null sin fallar si el consultaId tiene formato inválido', async () => {
    const resultado = await adapter.obtenerResumenConsulta('formato-invalido');

    expect(resultado).toBeNull();
    expect(buscarPorIdMock).not.toHaveBeenCalled();
  });
});
