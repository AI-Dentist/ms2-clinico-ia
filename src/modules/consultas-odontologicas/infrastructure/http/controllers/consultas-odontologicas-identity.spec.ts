import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import * as jose from 'jose';
import { RegistrarAperturaConsultaUseCase } from '../../../application/use-cases/registrar-apertura-consulta.use-case.js';
import { ConsultaOrdenCobroMs1Mapper } from '../../../application/mappers/consulta-orden-cobro-ms1.mapper.js';
import { KeycloakJwtOdontologoContextAdapter } from '../../../../../infrastructure/auth/keycloak-jwt-odontologo-context.adapter.js';
import { GraphqlMs1CanonicalDoctorResolverAdapter } from '../../../../../infrastructure/auth/graphql-ms1-canonical-doctor-resolver.adapter.js';
import type { IConsultaOdontologicaRepositoryPort } from '../../../domain/ports/consulta-odontologica.repository.port.js';
import type { IHistoriaClinicaContextPort } from '../../../domain/ports/historia-clinica-context.port.js';
import type { ICitaValidatorPort } from '../../../domain/ports/cita-validator.port.js';
import { ServicioFacturableConsulta } from '../../../domain/value-objects/servicio-facturable-consulta.vo.js';
import { OdontologoId } from '../../../domain/value-objects/odontologo-id.vo.js';

describe('Public Identity Contract: Canonical Resolution & Clinical Isolation (T4)', () => {
  const originalFetch = globalThis.fetch;
  const testSecret = 'super_secret_jwt_key_for_testing_12345';
  const defaultIssuer = 'http://localhost:8080/realms/dental-platform';
  const defaultAudience = 'ms2-clinico-ia';

  const KEYCLOAK_SUB_1 = '550e8400-e29b-41d4-a716-446655440001';
  const KEYCLOAK_SUB_2 = '550e8400-e29b-41d4-a716-446655440002';
  const CANONICAL_DOCTOR_UUID_1 = '70000000-0000-4000-a000-000000000001';
  const CANONICAL_DOCTOR_UUID_2 = '70000000-0000-4000-b000-000000000002';

  let mockRepository: IConsultaOdontologicaRepositoryPort;
  let mockHistoriaContext: IHistoriaClinicaContextPort;
  let mockCitaValidator: ICitaValidatorPort;
  let authAdapter: KeycloakJwtOdontologoContextAdapter;
  let resolverAdapter: GraphqlMs1CanonicalDoctorResolverAdapter;
  let useCase: RegistrarAperturaConsultaUseCase;
  let savedConsultas: any[] = [];

  beforeEach(() => {
    process.env.NODE_ENV = 'test';
    process.env.JWT_SECRET = testSecret;

    savedConsultas = [];
    mockRepository = {
      guardar: vi.fn().mockImplementation(async (consulta) => {
        savedConsultas.push(consulta);
      }),
      obtenerPorId: vi.fn(),
      existePorCitaId: vi.fn().mockResolvedValue(false),
      listarPorHistoriaClinica: vi.fn(),
    };

    mockHistoriaContext = {
      obtenerResumenParaApertura: vi.fn().mockResolvedValue({
        id: 'hc_123',
        pacienteId: '60000000-0000-0000-0000-000000000001',
        existe: true,
        estado: 'ACTIVA',
        version: 1,
        antecedentesMedicos: null,
        alergias: [],
        medicamentosActivos: [],
      }),
    };

    mockCitaValidator = {
      validarCitaParaConsulta: vi.fn().mockResolvedValue({
        valida: true,
        citaId: 'cita_123',
        pacienteId: '60000000-0000-0000-0000-000000000001',
        estado: 'CONFIRMADA',
      }),
    };

    resolverAdapter = new GraphqlMs1CanonicalDoctorResolverAdapter();
    authAdapter = new KeycloakJwtOdontologoContextAdapter(undefined, resolverAdapter);

    useCase = new RegistrarAperturaConsultaUseCase(
      mockRepository,
      mockHistoriaContext,
      mockCitaValidator,
      authAdapter,
    );
  });

  afterEach(() => {
    globalThis.fetch = originalFetch;
    delete process.env.JWT_SECRET;
    vi.restoreAllMocks();
  });

  async function generarToken(sub: string): Promise<string> {
    const secretBytes = new TextEncoder().encode(testSecret);
    return new jose.SignJWT({
      realm_access: { roles: ['ODONTOLOGO'] },
      iss: defaultIssuer,
      aud: defaultAudience,
    })
      .setProtectedHeader({ alg: 'HS256' })
      .setSubject(sub)
      .setExpirationTime('2h')
      .sign(secretBytes);
  }

  it('1. Debe reenviar el token del llamador y resolver sub != doctorPK al abrir consulta', async () => {
    let forwardedAuthHeader = '';

    globalThis.fetch = vi.fn().mockImplementation(async (_url, init) => {
      forwardedAuthHeader = (init?.headers as Record<string, string>)?.['Authorization'];
      return {
        ok: true,
        status: 200,
        json: async () => ({
          data: { obtenerMiOdontologoId: CANONICAL_DOCTOR_UUID_1 },
        }),
      } as Response;
    });

    const token = await generarToken(KEYCLOAK_SUB_1);

    const resultado = await useCase.execute({
      tokenAutenticacion: token,
      historiaClinicaId: 'hc_123',
      pacienteId: '60000000-0000-0000-0000-000000000001',
      motivoConsulta: 'Dolor agudo en molar inferior',
    });

    // 1. Token del llamador reenviado
    expect(forwardedAuthHeader).toBe(`Bearer ${token}`);
    // 2. Consulta guardada con el doctorPK canónico, no con el sub de Keycloak
    expect(resultado.odontologoId).toBe(CANONICAL_DOCTOR_UUID_1);
    expect(resultado.odontologoId).not.toBe(KEYCLOAK_SUB_1);
    expect(savedConsultas.length).toBe(1);
    expect(savedConsultas[0].odontologoId.valor).toBe(CANONICAL_DOCTOR_UUID_1);
  });

  it('2. El mapper emite el doctorPK canónico hacia MS1 para órdenes de cobro', async () => {
    globalThis.fetch = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => ({
        data: { obtenerMiOdontologoId: CANONICAL_DOCTOR_UUID_1 },
      }),
    });

    const token = await generarToken(KEYCLOAK_SUB_1);
    await useCase.execute({
      tokenAutenticacion: token,
      historiaClinicaId: 'hc_123',
      pacienteId: '60000000-0000-0000-0000-000000000001',
      motivoConsulta: 'Tratamiento restaurador',
      exploracionFisica: {
        inspeccionIntraoral: 'Exploración intraoral adecuada para apertura',
      },
      diagnosticos: [
        {
          codigoCIE10: 'K02.1',
          descripcion: 'Caries de la dentina',
        },
      ],
    });

    const consultaEntity = savedConsultas[0];
    const servicio = ServicioFacturableConsulta.crear({
      servicioId: '80000000-0000-0000-0000-000000000003',
      nombre: 'Restauración Oclusal',
      precioUnitarioBs: '300.00',
      cantidad: 1,
      piezaDental: 36,
    });

    consultaEntity.completar(OdontologoId.crear(CANONICAL_DOCTOR_UUID_1), {
      serviciosFacturables: [servicio],
      observacionesCobro: 'Cobro inmediato',
    });

    const mensajePlano = ConsultaOrdenCobroMs1Mapper.toMensajePlano(consultaEntity);
    expect(mensajePlano).not.toBeNull();
    // Invariante: Emite el doctor UUID canónico a MS1, no el sub
    expect(mensajePlano?.odontologoId).toBe(CANONICAL_DOCTOR_UUID_1);
    expect(mensajePlano?.odontologoId).not.toBe(KEYCLOAK_SUB_1);
  });

  it('3. Falla cerrado: Ante rechazo o fallo en MS1, NO se realizan escrituras clínicas ni outbox', async () => {
    // MS1 responde que el usuario no tiene odontólogo vinculado
    globalThis.fetch = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => ({
        data: { obtenerMiOdontologoId: null },
      }),
    });

    const token = await generarToken('user_sin_perfil_odontologo');

    await expect(
      useCase.execute({
        tokenAutenticacion: token,
        historiaClinicaId: 'hc_123',
        pacienteId: '60000000-0000-0000-0000-000000000001',
        motivoConsulta: 'Consulta no permitida',
      }),
    ).rejects.toThrow(/no está vinculado a un odontólogo activo/i);

    // Invariante de seguridad: Estado clínico intacto (0 guardados)
    expect(savedConsultas.length).toBe(0);
  });

  it('4. Concurrencia y Aislamiento: Dos llamadores concurrentes no comparten token ni identidad', async () => {
    const token1 = await generarToken(KEYCLOAK_SUB_1);
    const token2 = await generarToken(KEYCLOAK_SUB_2);
    const receivedAuthHeaders: string[] = [];

    globalThis.fetch = vi.fn().mockImplementation(async (_url, init) => {
      const auth = (init?.headers as Record<string, string>)?.['Authorization'];
      receivedAuthHeaders.push(auth);
      await new Promise((r) => setTimeout(r, 15));

      if (auth === `Bearer ${token1}`) {
        return {
          ok: true,
          status: 200,
          json: async () => ({ data: { obtenerMiOdontologoId: CANONICAL_DOCTOR_UUID_1 } }),
        };
      }
      return {
        ok: true,
        status: 200,
        json: async () => ({ data: { obtenerMiOdontologoId: CANONICAL_DOCTOR_UUID_2 } }),
      };
    });

    // Ejecución estrictamente concurrente
    const [res1, res2] = await Promise.all([
      useCase.execute({
        tokenAutenticacion: token1,
        historiaClinicaId: 'hc_123',
        pacienteId: '60000000-0000-0000-0000-000000000001',
        motivoConsulta: 'Consulta Caller 1',
      }),
      useCase.execute({
        tokenAutenticacion: token2,
        historiaClinicaId: 'hc_123',
        pacienteId: '60000000-0000-0000-0000-000000000001',
        motivoConsulta: 'Consulta Caller 2',
      }),
    ]);

    expect(res1.odontologoId).toBe(CANONICAL_DOCTOR_UUID_1);
    expect(res2.odontologoId).toBe(CANONICAL_DOCTOR_UUID_2);
    expect(savedConsultas.length).toBe(2);
    expect(savedConsultas.map((c) => c.odontologoId.valor)).toEqual([
      CANONICAL_DOCTOR_UUID_1,
      CANONICAL_DOCTOR_UUID_2,
    ]);
  });
});
