import { describe, it, expect, vi, beforeEach } from 'vitest';
import { LocalHistoriaClinicaContextAdapter } from './local-historia-clinica-context.adapter.js';
import type { IHistoriaClinicaRepository } from '../../../historias-clinicas/domain/ports/historia-clinica.repository.port.js';
import { HistoriaClinica } from '../../../historias-clinicas/domain/entities/historia-clinica.entity.js';
import { PacienteId } from '../../../historias-clinicas/domain/value-objects/paciente-id.vo.js';
import { OdontologoId } from '../../../historias-clinicas/domain/value-objects/odontologo-id.vo.js';
import { Alergia } from '../../../historias-clinicas/domain/value-objects/alergia.vo.js';
import { SeveridadAlergia } from '../../../historias-clinicas/domain/value-objects/severidad-alergia.enum.js';
import { Medicamento } from '../../../historias-clinicas/domain/value-objects/medicamento.vo.js';
import { Antecedentes } from '../../../historias-clinicas/domain/value-objects/antecedentes.vo.js';
import { CampoClinico } from '../../../historias-clinicas/domain/value-objects/campo-clinico.vo.js';

describe('LocalHistoriaClinicaContextAdapter', () => {
  let adapter: LocalHistoriaClinicaContextAdapter;
  let mockRepo: { [K in keyof IHistoriaClinicaRepository]: ReturnType<typeof vi.fn> };

  beforeEach(() => {
    mockRepo = {
      guardar: vi.fn(),
      buscarPorId: vi.fn(),
      buscarPorPacienteId: vi.fn(),
      existePorPacienteId: vi.fn(),
      actualizar: vi.fn(),
    };

    adapter = new LocalHistoriaClinicaContextAdapter(
      mockRepo as unknown as IHistoriaClinicaRepository
    );
  });

  it('debe extraer el resumen para apertura con alergias, condiciones médicas y medicamentos', async () => {
    const historia = HistoriaClinica.crear({
      pacienteId: PacienteId.crear('pac_dennis_01'),
      odontologoResponsableId: OdontologoId.crear('od_henry_01'),
      alergias: [
        Alergia.crear({
          sustancia: 'Penicilina',
          severidad: SeveridadAlergia.GRAVE,
          tipoReaccion: 'Shock anafiláctico',
          notasAdicionales: null,
        }),
      ],
      medicamentosActuales: [
        Medicamento.crear({
          nombre: 'Enalapril',
          principioActivo: 'Enalapril maleato',
          dosis: '10mg',
          motivoUso: 'Hipertensión',
          prescritoDesde: new Date('2025-01-01'),
        }),
      ],
      antecedentes: Antecedentes.crear({
        enfermedadesCronicas: [
          CampoClinico.crear({
            nombre: 'Hipertensión',
            estado: 'CONFIRMADO',
            detalle: 'Hipertensión arterial primaria controlada',
          }),
        ],
        antecedentesMedicos: [],
        antecedentesFamiliares: [],
        antecedentesOdontologicos: {
          tratamientoPrevio: CampoClinico.crear({ estado: 'NO_EVALUADO' }),
          protesisActual: CampoClinico.crear({ estado: 'NO_EVALUADO' }),
          sangradoGingival: CampoClinico.crear({
            estado: 'CONFIRMADO',
            detalle: 'Sangrado espontáneo frecuente',
          }),
          bruxismo: CampoClinico.crear({ estado: 'NO_EVALUADO' }),
        },
      }),
    }, OdontologoId.crear('od_henry_01'));

    mockRepo.buscarPorId.mockResolvedValue(historia);

    const resumen = await adapter.obtenerResumenParaApertura(historia.id.valor);

    expect(resumen).not.toBeNull();
    expect(resumen?.existe).toBe(true);
    expect(resumen?.pacienteId).toBe('pac_dennis_01');
    expect(resumen?.estado).toBe('ACTIVA');
    expect(resumen?.versionActual).toBe(1);
    expect(resumen?.alergiasCriticas.length).toBe(1);
    expect(resumen?.alergiasCriticas[0].sustancia).toBe('Penicilina');
    expect(resumen?.alergiasCriticas[0].severidad).toBe(SeveridadAlergia.GRAVE);
    expect(resumen?.condicionesMedicas).toContain(
      'Hipertensión: Hipertensión arterial primaria controlada'
    );
    expect(resumen?.condicionesMedicas).toContain(
      'Sangrado gingival: Sangrado espontáneo frecuente'
    );
    expect(resumen?.medicacionHabitual[0]).toContain('Enalapril (Enalapril maleato) - Dosis: 10mg');
  });

  it('debe retornar null si la historia clínica no existe', async () => {
    mockRepo.buscarPorId.mockResolvedValue(null);

    const resumen = await adapter.obtenerResumenParaApertura('hc_no_existe_1234');
    expect(resumen).toBeNull();
  });

  it('debe retornar null si el identificador tiene un formato inválido', async () => {
    const resumen = await adapter.obtenerResumenParaApertura('');
    expect(resumen).toBeNull();
  });
});
