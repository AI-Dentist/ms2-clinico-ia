import { describe, it, expect, beforeEach, vi } from 'vitest';
import { ValidationPipe, ArgumentMetadata } from '@nestjs/common';
import { plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';
import { OdontogramasController } from './odontogramas.controller.js';
import {
  InicializarOdontogramaHttpDto,
  RegistrarRevisionOdontogramaHttpDto,
  DeltaPiezaHttpDto,
  ListarHistorialQueryHttpDto,
} from '../dtos/index.js';
import { TipoRevisionOdontograma } from '../../../domain/value-objects/tipo-revision-odontograma.enum.js';
import { EstadoAnatomicoPieza } from '../../../domain/value-objects/estado-anatomico-pieza.enum.js';
import { TipoSuperficie } from '../../../domain/value-objects/tipo-superficie.enum.js';
import { CondicionSuperficie } from '../../../domain/value-objects/condicion-superficie.enum.js';
import { TipoTratamientoEstructural } from '../../../domain/value-objects/tipo-tratamiento-estructural.enum.js';
import type {
  InicializarOdontogramaUseCase,
  ObtenerOdontogramaActualUseCase,
  RegistrarRevisionOdontogramaUseCase,
  ListarHistorialRevisionesUseCase,
  ObtenerSnapshotRevisionUseCase,
  ObtenerSnapshotsPorConsultaUseCase,
  OdontogramaActualDto,
  RevisionOdontogramaDto,
  ListadoRevisionesPaginadoDto,
} from '../../../application/index.js';

describe('OdontogramasController (Unit Tests & DTO Validations)', () => {
  let controller: OdontogramasController;
  let mockInicializarUseCase: Partial<InicializarOdontogramaUseCase>;
  let mockObtenerActualUseCase: Partial<ObtenerOdontogramaActualUseCase>;
  let mockRegistrarRevisionUseCase: Partial<RegistrarRevisionOdontogramaUseCase>;
  let mockListarHistorialUseCase: Partial<ListarHistorialRevisionesUseCase>;
  let mockObtenerSnapshotUseCase: Partial<ObtenerSnapshotRevisionUseCase>;
  let mockObtenerPorConsultaUseCase: Partial<ObtenerSnapshotsPorConsultaUseCase>;

  const mockOdontogramaActual: OdontogramaActualDto = {
    id: 'odo_canonical_001',
    historiaClinicaId: 'hc_canonical_001',
    pacienteId: 'pac_canonical_001',
    revisionActualId: 'rev_basal_001',
    totalRevisiones: 1,
    version: 1,
    creadoEn: '2026-10-26T08:00:00.000Z',
    actualizadoEn: '2026-10-26T08:00:00.000Z',
    actualizadoPor: 'od_001',
    piezas: [
      {
        numeroFDI: 16,
        estadoAnatomico: EstadoAnatomicoPieza.DESCONOCIDO,
        estadoEvaluacion: 'NO_EVALUADO',
        superficies: {},
        tratamientosEstructurales: [],
        observaciones: null,
      },
    ],
  };

  const mockRevision: RevisionOdontogramaDto = {
    id: 'rev_canonical_001',
    odontogramaId: 'odo_canonical_001',
    historiaClinicaId: 'hc_canonical_001',
    consultaId: 'cons_canonical_001',
    numeroRevision: 2,
    tipoRevision: TipoRevisionOdontograma.NUEVA_OBSERVACION,
    revisionCorregidaId: null,
    aplicaAlEstadoActual: true,
    fechaRegistro: '2026-10-26T08:30:00.000Z',
    fechaObservacionClinica: '2026-10-26T08:30:00.000Z',
    registradoPor: 'od_001',
    motivoRevision: 'Restauración oclusal pieza 16',
    cambiosAplicados: [
      {
        numeroFDI: 16,
        estadoAnatomicoNuevo: EstadoAnatomicoPieza.PRESENTE,
        superficiesModificadas: [
          {
            superficie: TipoSuperficie.OCLUSAL_INCISAL,
            condicionAnterior: CondicionSuperficie.NO_EVALUADA,
            condicionNueva: CondicionSuperficie.OBTURACION_RESINA,
          },
        ],
      },
    ],
    snapshotPiezas: [],
  };

  const mockListadoHistorial: ListadoRevisionesPaginadoDto = {
    total: 1,
    limite: 20,
    offset: 0,
    revisiones: [mockRevision],
  };

  const validationPipe = new ValidationPipe({
    whitelist: true,
    forbidNonWhitelisted: true,
    transform: true,
  });

  beforeEach(() => {
    mockInicializarUseCase = {
      ejecutar: vi.fn().mockResolvedValue(mockOdontogramaActual),
    };
    mockObtenerActualUseCase = {
      ejecutar: vi.fn().mockResolvedValue(mockOdontogramaActual),
    };
    mockRegistrarRevisionUseCase = {
      ejecutar: vi.fn().mockResolvedValue(mockRevision),
    };
    mockListarHistorialUseCase = {
      ejecutar: vi.fn().mockResolvedValue(mockListadoHistorial),
    };
    mockObtenerSnapshotUseCase = {
      ejecutar: vi.fn().mockResolvedValue(mockRevision),
    };
    mockObtenerPorConsultaUseCase = {
      ejecutar: vi.fn().mockResolvedValue([mockRevision]),
    };

    controller = new OdontogramasController(
      mockInicializarUseCase as InicializarOdontogramaUseCase,
      mockObtenerActualUseCase as ObtenerOdontogramaActualUseCase,
      mockRegistrarRevisionUseCase as RegistrarRevisionOdontogramaUseCase,
      mockListarHistorialUseCase as ListarHistorialRevisionesUseCase,
      mockObtenerSnapshotUseCase as ObtenerSnapshotRevisionUseCase,
      mockObtenerPorConsultaUseCase as ObtenerSnapshotsPorConsultaUseCase,
    );
  });

  // 1. Inicialización exitosa
  it('1. debe inicializar el odontograma exitosamente delegando al caso de uso', async () => {
    const dto: InicializarOdontogramaHttpDto = {
      historiaClinicaId: 'hc_canonical_001',
    };
    const token = 'token_valido';

    const resultado = await controller.inicializar(dto, token);

    expect(resultado).toEqual(mockOdontogramaActual);
    expect(mockInicializarUseCase.ejecutar).toHaveBeenCalledTimes(1);
    expect(mockInicializarUseCase.ejecutar).toHaveBeenCalledWith({
      historiaClinicaId: 'hc_canonical_001',
      tokenOdontologo: 'token_valido',
    });
  });

  // 2. Validación de historiaClinicaId
  it('2. debe rechazar mediante class-validator un DTO con historiaClinicaId vacío o no string', async () => {
    const dtoVacio = plainToInstance(InicializarOdontogramaHttpDto, {
      historiaClinicaId: '',
    });
    const erroresVacio = await validate(dtoVacio);
    expect(erroresVacio.length).toBeGreaterThan(0);
    expect(erroresVacio[0].constraints).toHaveProperty('isNotEmpty');

    const dtoNoString = plainToInstance(InicializarOdontogramaHttpDto, {
      historiaClinicaId: 12345,
    });
    const erroresNoString = await validate(dtoNoString);
    expect(erroresNoString.length).toBeGreaterThan(0);
    expect(erroresNoString[0].constraints).toHaveProperty('isString');
  });

  // 3. Obtención del estado actual
  it('3. debe obtener el estado actual del odontograma preservando estados basales', async () => {
    const resultado = await controller.obtenerActual('hc_canonical_001');

    expect(resultado).toEqual(mockOdontogramaActual);
    expect(resultado.piezas[0].estadoAnatomico).toBe(EstadoAnatomicoPieza.DESCONOCIDO);
    expect(resultado.piezas[0].estadoEvaluacion).toBe('NO_EVALUADO');
    expect(mockObtenerActualUseCase.ejecutar).toHaveBeenCalledWith({
      historiaClinicaId: 'hc_canonical_001',
    });
  });

  // 4. Registro de revisión válida
  it('4. debe registrar una revisión válida con sus deltas y retornar 201', async () => {
    const dto: RegistrarRevisionOdontogramaHttpDto = {
      versionEsperada: 1,
      tipoRevision: TipoRevisionOdontograma.NUEVA_OBSERVACION,
      consultaId: 'cons_canonical_001',
      fechaObservacionClinica: '2026-10-26T08:30:00.000Z',
      motivoRevision: 'Restauración oclusal pieza 16',
      deltas: [
        {
          numeroFDI: 16,
          estadoAnatomicoNuevo: EstadoAnatomicoPieza.PRESENTE,
          superficiesModificadas: [
            {
              superficie: TipoSuperficie.OCLUSAL_INCISAL,
              condicionAnterior: CondicionSuperficie.NO_EVALUADA,
              condicionNueva: CondicionSuperficie.OBTURACION_RESINA,
            },
          ],
        },
      ],
      revisionCorregidaId: null,
      aplicaAlEstadoActual: true,
    };
    const token = 'token_valido';

    const resultado = await controller.registrarRevision('odo_canonical_001', dto, token);

    expect(resultado).toEqual(mockRevision);
    expect(mockRegistrarRevisionUseCase.ejecutar).toHaveBeenCalledTimes(1);
    expect(mockRegistrarRevisionUseCase.ejecutar).toHaveBeenCalledWith({
      odontogramaId: 'odo_canonical_001',
      versionEsperada: 1,
      tipoRevision: TipoRevisionOdontograma.NUEVA_OBSERVACION,
      consultaId: 'cons_canonical_001',
      fechaObservacionClinica: '2026-10-26T08:30:00.000Z',
      motivoRevision: 'Restauración oclusal pieza 16',
      deltas: dto.deltas,
      revisionCorregidaId: null,
      aplicaAlEstadoActual: true,
      tokenOdontologo: 'token_valido',
    });
  });

  // 5. Revisión sin versionEsperada
  it('5. debe rechazar un DTO de revisión sin versionEsperada o con version menor a 1', async () => {
    const dtoSinVersion = plainToInstance(RegistrarRevisionOdontogramaHttpDto, {
      tipoRevision: TipoRevisionOdontograma.NUEVA_OBSERVACION,
      fechaObservacionClinica: '2026-10-26T08:30:00.000Z',
      motivoRevision: 'Sin version',
      deltas: [],
      aplicaAlEstadoActual: true,
    });
    const erroresSinVersion = await validate(dtoSinVersion);
    const errorVersion = erroresSinVersion.find((e) => e.property === 'versionEsperada');
    expect(errorVersion).toBeDefined();

    const dtoVersionInvalida = plainToInstance(RegistrarRevisionOdontogramaHttpDto, {
      versionEsperada: 0,
      tipoRevision: TipoRevisionOdontograma.NUEVA_OBSERVACION,
      fechaObservacionClinica: '2026-10-26T08:30:00.000Z',
      motivoRevision: 'Version cero',
      deltas: [],
      aplicaAlEstadoActual: true,
    });
    const erroresVersionInvalida = await validate(dtoVersionInvalida);
    const errorMin = erroresVersionInvalida.find((e) => e.property === 'versionEsperada');
    expect(errorMin?.constraints).toHaveProperty('min');
  });

  // 6. Revisión con número FDI inválido
  it('6. debe rechazar mediante class-validator números FDI anatómicamente inexistentes (ej: 19, 20, 29, 56)', async () => {
    const fdiInexistentes = [19, 20, 29, 56, 99, 10, 49];

    for (const fdi of fdiInexistentes) {
      const delta = plainToInstance(DeltaPiezaHttpDto, {
        numeroFDI: fdi,
      });
      const errores = await validate(delta);
      const errorFdi = errores.find((e) => e.property === 'numeroFDI');
      expect(errorFdi).toBeDefined();
      expect(errorFdi?.constraints).toHaveProperty('esNumeroFDIValido');
    }

    // Pieza válida 16 (primer molar superior permanente)
    const deltaValido = plainToInstance(DeltaPiezaHttpDto, {
      numeroFDI: 16,
    });
    const erroresValido = await validate(deltaValido);
    const errorFdiValido = erroresValido.find((e) => e.property === 'numeroFDI');
    expect(errorFdiValido).toBeUndefined();
  });

  // 7. Revisión con enum inválido
  it('7. debe rechazar un DTO de revisión con enum tipoRevision inválido', async () => {
    const dto = plainToInstance(RegistrarRevisionOdontogramaHttpDto, {
      versionEsperada: 1,
      tipoRevision: 'TIPO_INEXISTENTE_EN_DOMINIO',
      fechaObservacionClinica: '2026-10-26T08:30:00.000Z',
      motivoRevision: 'Test enum',
      deltas: [],
      aplicaAlEstadoActual: true,
    });
    const errores = await validate(dto);
    const errorEnum = errores.find((e) => e.property === 'tipoRevision');
    expect(errorEnum).toBeDefined();
    expect(errorEnum?.constraints).toHaveProperty('isEnum');
  });

  // 8. Revisión con deltas anidados inválidos
  it('8. debe rechazar revisiones con deltas anidados que posean enums de superficie inválidos', async () => {
    const dto = plainToInstance(RegistrarRevisionOdontogramaHttpDto, {
      versionEsperada: 1,
      tipoRevision: TipoRevisionOdontograma.NUEVA_OBSERVACION,
      fechaObservacionClinica: '2026-10-26T08:30:00.000Z',
      motivoRevision: 'Deltas anidados inválidos',
      deltas: [
        {
          numeroFDI: 16,
          superficiesModificadas: [
            {
              superficie: 'SUPERFICIE_INVENTADA',
              condicionAnterior: CondicionSuperficie.SANA,
              condicionNueva: CondicionSuperficie.CARIES,
            },
          ],
        },
      ],
      aplicaAlEstadoActual: true,
    });

    const errores = await validate(dto);
    expect(errores.length).toBeGreaterThan(0);
    const errorDeltas = errores.find((e) => e.property === 'deltas');
    expect(errorDeltas).toBeDefined();
    expect(errorDeltas?.children?.length).toBeGreaterThan(0);
  });

  // 9. Consulta de historial con paginación
  it('9. debe consultar el historial paginado delegando al caso de uso con límite y offset', async () => {
    const query: ListarHistorialQueryHttpDto = {
      limite: 15,
      offset: 5,
    };

    const resultado = await controller.listarHistorial('odo_canonical_001', query);

    expect(resultado).toEqual(mockListadoHistorial);
    expect(mockListarHistorialUseCase.ejecutar).toHaveBeenCalledTimes(1);
    expect(mockListarHistorialUseCase.ejecutar).toHaveBeenCalledWith({
      odontogramaId: 'odo_canonical_001',
      limite: 15,
      offset: 5,
    });
  });

  // 10. Historial con límite inválido
  it('10. debe rechazar parámetros de paginación con límite fuera de rango [1, 100] u offset negativo', async () => {
    const queryLimiteCero = plainToInstance(ListarHistorialQueryHttpDto, {
      limite: 0,
      offset: 0,
    });
    const erroresMin = await validate(queryLimiteCero);
    const errorLimiteMin = erroresMin.find((e) => e.property === 'limite');
    expect(errorLimiteMin?.constraints).toHaveProperty('min');

    const queryLimiteExcesivo = plainToInstance(ListarHistorialQueryHttpDto, {
      limite: 150,
      offset: 0,
    });
    const erroresMax = await validate(queryLimiteExcesivo);
    const errorLimiteMax = erroresMax.find((e) => e.property === 'limite');
    expect(errorLimiteMax?.constraints).toHaveProperty('max');

    const queryOffsetNegativo = plainToInstance(ListarHistorialQueryHttpDto, {
      limite: 20,
      offset: -1,
    });
    const erroresOffset = await validate(queryOffsetNegativo);
    const errorOffset = erroresOffset.find((e) => e.property === 'offset');
    expect(errorOffset?.constraints).toHaveProperty('min');
  });

  // 11. Obtención de snapshot histórico
  it('11. debe obtener un snapshot histórico específico por ID de revisión y de odontograma', async () => {
    const resultado = await controller.obtenerSnapshot('odo_canonical_001', 'rev_canonical_001');

    expect(resultado).toEqual(mockRevision);
    expect(mockObtenerSnapshotUseCase.ejecutar).toHaveBeenCalledTimes(1);
    expect(mockObtenerSnapshotUseCase.ejecutar).toHaveBeenCalledWith({
      odontogramaId: 'odo_canonical_001',
      revisionId: 'rev_canonical_001',
    });
  });

  // 12. Listado de múltiples revisiones por consulta
  it('12. debe listar todas las revisiones asociadas a una consulta odontológica', async () => {
    const segundaRevision: RevisionOdontogramaDto = {
      ...mockRevision,
      id: 'rev_canonical_002',
      numeroRevision: 3,
    };
    mockObtenerPorConsultaUseCase.ejecutar = vi.fn().mockResolvedValue([mockRevision, segundaRevision]);

    const resultado = await controller.obtenerPorConsulta('cons_canonical_001');

    expect(resultado).toHaveLength(2);
    expect(resultado[0].id).toBe('rev_canonical_001');
    expect(resultado[1].id).toBe('rev_canonical_002');
    expect(mockObtenerPorConsultaUseCase.ejecutar).toHaveBeenCalledWith({
      consultaId: 'cons_canonical_001',
    });
  });

  // 13. Ausencia de identidad odontológica arbitraria desde el body
  it('13. debe rechazar mediante ValidationPipe con whitelist la inyección de odontologoId o pacienteId arbitrario en el body', async () => {
    const metadataInicializar: ArgumentMetadata = {
      type: 'body',
      metatype: InicializarOdontogramaHttpDto,
    };

    // Intento malicioso de forzar pacienteId u odontologoId en inicializar
    await expect(
      validationPipe.transform(
        {
          historiaClinicaId: 'hc_canonical_001',
          pacienteId: 'paciente_arbitrario_hack',
          odontologoId: 'od_hacker_falso',
        },
        metadataInicializar,
      ),
    ).rejects.toThrow();

    const metadataRevision: ArgumentMetadata = {
      type: 'body',
      metatype: RegistrarRevisionOdontogramaHttpDto,
    };

    // Intento malicioso de forzar odontologoId en registrar revisión
    await expect(
      validationPipe.transform(
        {
          versionEsperada: 1,
          tipoRevision: TipoRevisionOdontograma.NUEVA_OBSERVACION,
          fechaObservacionClinica: '2026-10-26T08:30:00.000Z',
          motivoRevision: 'Revisión con intento de suplantación',
          deltas: [],
          aplicaAlEstadoActual: true,
          odontologoId: 'od_suplantado_009',
        },
        metadataRevision,
      ),
    ).rejects.toThrow();
  });

  // 14. Correcta delegación a Application
  it('14. debe mapear los parámetros hacia comandos y queries de Application sin alterar invariantes', async () => {
    const dto: RegistrarRevisionOdontogramaHttpDto = {
      versionEsperada: 2,
      tipoRevision: TipoRevisionOdontograma.ENMIENDA_CORRECTIVA,
      consultaId: 'cons_999',
      fechaObservacionClinica: '2026-10-26T12:00:00.000Z',
      motivoRevision: 'Enmienda de registro previo',
      deltas: [
        {
          numeroFDI: 21,
          estadoAnatomicoNuevo: EstadoAnatomicoPieza.PRESENTE,
          tratamientoEstructuralAgregado: TipoTratamientoEstructural.CORONA,
          observaciones: 'Prótesis unidentaria fija',
        },
      ],
      revisionCorregidaId: 'rev_111',
      aplicaAlEstadoActual: false,
    };

    await controller.registrarRevision('odo_555', dto, 'token_dev_henry');

    expect(mockRegistrarRevisionUseCase.ejecutar).toHaveBeenCalledWith({
      odontogramaId: 'odo_555',
      versionEsperada: 2,
      tipoRevision: TipoRevisionOdontograma.ENMIENDA_CORRECTIVA,
      consultaId: 'cons_999',
      fechaObservacionClinica: '2026-10-26T12:00:00.000Z',
      motivoRevision: 'Enmienda de registro previo',
      deltas: dto.deltas,
      revisionCorregidaId: 'rev_111',
      aplicaAlEstadoActual: false,
      tokenOdontologo: 'token_dev_henry',
    });
  });

  // 15. Ausencia de llamadas de escritura al crear el controlador
  it('15. la instanciación del controlador no debe ejecutar ningún caso de uso ni realizar escrituras', () => {
    const localInicializarSpy = vi.fn();
    const localRevisionSpy = vi.fn();

    const _ctrl = new OdontogramasController(
      { ejecutar: localInicializarSpy } as unknown as InicializarOdontogramaUseCase,
      mockObtenerActualUseCase as ObtenerOdontogramaActualUseCase,
      { ejecutar: localRevisionSpy } as unknown as RegistrarRevisionOdontogramaUseCase,
      mockListarHistorialUseCase as ListarHistorialRevisionesUseCase,
      mockObtenerSnapshotUseCase as ObtenerSnapshotRevisionUseCase,
      mockObtenerPorConsultaUseCase as ObtenerSnapshotsPorConsultaUseCase,
    );

    expect(_ctrl).toBeDefined();
    expect(localInicializarSpy).not.toHaveBeenCalled();
    expect(localRevisionSpy).not.toHaveBeenCalled();
    expect(mockInicializarUseCase.ejecutar).not.toHaveBeenCalled();
    expect(mockRegistrarRevisionUseCase.ejecutar).not.toHaveBeenCalled();
  });
});
