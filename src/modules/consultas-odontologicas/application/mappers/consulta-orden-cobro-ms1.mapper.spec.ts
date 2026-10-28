import { describe, it, expect } from 'vitest';
import { ConsultaOrdenCobroMs1Mapper } from './consulta-orden-cobro-ms1.mapper.js';
import { ConsultaOdontologica } from '../../domain/entities/consulta-odontologica.entity.js';
import { ConsultaId } from '../../domain/value-objects/consulta-id.vo.js';
import { HistoriaClinicaId } from '../../domain/value-objects/historia-clinica-id.vo.js';
import { PacienteId } from '../../domain/value-objects/paciente-id.vo.js';
import { OdontologoId } from '../../domain/value-objects/odontologo-id.vo.js';
import { MotivoConsulta } from '../../domain/value-objects/motivo-consulta.vo.js';
import { SnapshotRiesgoClinico } from '../../domain/value-objects/snapshot-riesgo-clinico.vo.js';
import { ExploracionFisica } from '../../domain/value-objects/exploracion-fisica.vo.js';
import { DiagnosticoItem } from '../../domain/value-objects/diagnostico-item.vo.js';
import { ServicioFacturableConsulta } from '../../domain/value-objects/servicio-facturable-consulta.vo.js';

describe('ConsultaOrdenCobroMs1Mapper', () => {
  const CONSULTA_UUID = '550e8400-e29b-41d4-a716-446655440000';
  const PACIENTE_UUID = '60000000-0000-0000-0000-000000000001';
  const ODONTOLOGO_UUID = '70000000-0000-0000-0000-000000000002';
  const SERVICIO_UUID = '80000000-0000-0000-0000-000000000003';

  function crearConsultaCompletada(
    servicios: ServicioFacturableConsulta[] = [],
    observacionesCobro: string | null = null,
  ): ConsultaOdontologica {
    const consulta = ConsultaOdontologica.abrir({
      id: ConsultaId.reconstituir(`cons_${CONSULTA_UUID}`),
      historiaClinicaId: HistoriaClinicaId.crear('hc_123'),
      pacienteId: PacienteId.crear(PACIENTE_UUID),
      odontologoId: OdontologoId.crear(ODONTOLOGO_UUID),
      versionHistoriaReferenciada: 1,
      snapshotRiesgoClinico: SnapshotRiesgoClinico.vacio(),
      motivoConsulta: MotivoConsulta.crear('Dolor en pieza 16'),
      exploracionFisica: ExploracionFisica.reconstituir({
        inspeccionExtraoral: null,
        inspeccionIntraoral: 'Caries profunda en oclusal',
        hallazgosDentales: null,
      }),
      diagnosticos: [
        DiagnosticoItem.crear({
          codigoCIE10: 'K02.1',
          descripcion: 'Caries de la dentina',
        }),
      ],
    });

    consulta.completar(OdontologoId.crear(ODONTOLOGO_UUID), {
      serviciosFacturables: servicios,
      observacionesCobro,
    });

    return consulta;
  }

  it('1. Debe retornar null si la consulta no tiene servicios facturables (sin orden de cobro)', () => {
    const consultaSinCobro = crearConsultaCompletada([]);
    const mensaje = ConsultaOrdenCobroMs1Mapper.toMensajePlano(consultaSinCobro);
    expect(mensaje).toBeNull();
  });

  it('2. Debe transformar correctamente a mensaje plano requerido por MS1 con piezaDental en string', () => {
    const servicioConPieza = ServicioFacturableConsulta.crear({
      servicioId: SERVICIO_UUID,
      codigo: 'REST-01',
      nombre: 'Restauración Resina Fotocurable',
      cantidad: 1,
      precioUnitarioBs: '280.00',
      piezaDental: 16,
    });

    const servicioSinPieza = ServicioFacturableConsulta.crear({
      servicioId: '90000000-0000-0000-0000-000000000004',
      nombre: 'Profilaxis General',
      cantidad: 2,
      precioUnitarioBs: '150.00',
    });

    const consulta = crearConsultaCompletada(
      [servicioConPieza, servicioSinPieza],
      'Facturar a nombre de Juan Pérez',
    );

    const mensaje = ConsultaOrdenCobroMs1Mapper.toMensajePlano(consulta);

    expect(mensaje).not.toBeNull();
    expect(mensaje).toEqual({
      consultaId: CONSULTA_UUID,
      pacienteId: PACIENTE_UUID,
      odontologoId: ODONTOLOGO_UUID,
      serviciosRealizados: [
        {
          servicioId: SERVICIO_UUID,
          cantidad: 1,
          precioUnitarioBs: '280.00',
          piezaDental: '16', // Convertido de number FDI a string
        },
        {
          servicioId: '90000000-0000-0000-0000-000000000004',
          cantidad: 2,
          precioUnitarioBs: '150.00',
          piezaDental: null,
        },
      ],
      observacionesCobro: 'Facturar a nombre de Juan Pérez',
    });
  });
});

