import { describe, it, expect, beforeEach, vi } from 'vitest';
import { ExecutionContext, UnauthorizedException } from '@nestjs/common';
import { OdontologoAuthGuard, type RequestConOperador } from './odontologo-auth.guard.js';
import type { IOdontologoContextPort } from '../../../application/ports/odontologo-context.port.js';
import { AutenticacionRequeridaError } from '../../adapters/errors/autenticacion-requerida.error.js';

describe('OdontologoAuthGuard (Unit Security Tests)', () => {
  let guard: OdontologoAuthGuard;
  let mockPort: Partial<IOdontologoContextPort>;

  function crearMockContext(headers: Record<string, string | undefined>): {
    context: ExecutionContext;
    request: RequestConOperador;
  } {
    const request = {
      headers,
    } as unknown as RequestConOperador;

    const context = {
      switchToHttp: () => ({
        getRequest: () => request,
        getResponse: vi.fn(),
      }),
    } as unknown as ExecutionContext;

    return { context, request };
  }

  beforeEach(() => {
    mockPort = {
      obtenerOdontologoActual: vi.fn().mockImplementation(async (token?: string) => {
        if (token === 'token_valido_123' || token === 'token_dev_henry') {
          return { odontologoId: 'od_operador_001' };
        }
        throw new AutenticacionRequeridaError('Token de autenticación inválido o no reconocido.');
      }),
    };

    guard = new OdontologoAuthGuard(mockPort as IOdontologoContextPort);
  });

  // 1. Sin header Authorization
  it('1. debe lanzar 401 Unauthorized cuando no se envía la cabecera Authorization', async () => {
    const { context } = crearMockContext({});

    await expect(guard.canActivate(context)).rejects.toThrow(UnauthorizedException);
    await expect(guard.canActivate(context)).rejects.toThrow(
      'Header Authorization no proporcionado. Se requiere autenticación Bearer.',
    );
    expect(mockPort.obtenerOdontologoActual).not.toHaveBeenCalled();
  });

  // 2. Cabecera malformada
  it('2. debe lanzar 401 Unauthorized ante cabeceras con esquema diferente a Bearer o malformadas', async () => {
    const cabecerasInvalidas = [
      'Basic dXNlcjpwYXNz',
      'Token token_valido_123',
      'BearerTokenSinEspacio',
      'Bearer token_1 token_extra',
      'Bearer',
    ];

    for (const authHeader of cabecerasInvalidas) {
      const { context } = crearMockContext({ authorization: authHeader });
      await expect(guard.canActivate(context)).rejects.toThrow(UnauthorizedException);
    }
  });

  // 3. Bearer con token vacío o solo espacios
  it('3. debe lanzar 401 Unauthorized cuando el token Bearer está vacío o contiene solo espacios', async () => {
    const { context } = crearMockContext({ authorization: 'Bearer   ' });

    await expect(guard.canActivate(context)).rejects.toThrow(UnauthorizedException);
    await expect(guard.canActivate(context)).rejects.toThrow('Token de autenticación vacío.');
  });

  // 4. Token desconocido o no reconocido por la lista blanca
  it('4. debe lanzar 401 Unauthorized cuando el token no pertenece a la lista blanca sintética', async () => {
    const { context } = crearMockContext({ authorization: 'Bearer token_intruso_desconocido' });

    await expect(guard.canActivate(context)).rejects.toThrow(UnauthorizedException);
    await expect(guard.canActivate(context)).rejects.toThrow(
      'Token de autenticación inválido o no reconocido.',
    );
  });

  // 5. Token sintético válido en dev/test
  it('5. debe autorizar con token válido e inyectar operadorToken y odontologoActual en la request', async () => {
    const { context, request } = crearMockContext({ authorization: 'Bearer token_valido_123' });

    const autorizado = await guard.canActivate(context);

    expect(autorizado).toBe(true);
    expect(request.operadorToken).toBe('token_valido_123');
    expect(request.odontologoActual).toEqual({ odontologoId: 'od_operador_001' });
    expect(mockPort.obtenerOdontologoActual).toHaveBeenCalledWith('token_valido_123');
  });

  // 6. Entorno deshabilitado por política de seguridad
  it('6. debe lanzar 401 Unauthorized seguro si el adaptador de desarrollo está deshabilitado por entorno', async () => {
    mockPort.obtenerOdontologoActual = vi.fn().mockRejectedValue(
      new Error('CRÍTICO: MockOdontologoContextAdapter deshabilitado por política de seguridad.'),
    );

    const { context } = crearMockContext({ authorization: 'Bearer token_dev_henry' });

    await expect(guard.canActivate(context)).rejects.toThrow(UnauthorizedException);
    await expect(guard.canActivate(context)).rejects.toThrow(
      'Mecanismo de autenticación no disponible en este entorno.',
    );
  });

  // 7. No propagar tokens sensibles en logs de error no autorizados
  it('7. no debe exponer el contenido del token en los mensajes de excepción lanzados', async () => {
    const secretToken = 'super_secret_forbidden_token_xyz_999';
    const { context } = crearMockContext({ authorization: `Bearer ${secretToken}` });

    try {
      await guard.canActivate(context);
      expect.fail('Debió lanzar excepción');
    } catch (err) {
      expect(err).toBeInstanceOf(UnauthorizedException);
      const msg = (err as UnauthorizedException).message;
      expect(msg).not.toContain(secretToken);
    }
  });
});
