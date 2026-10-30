import { describe, it, expect, beforeEach, vi } from 'vitest';
import { ExecutionContext, ForbiddenException, UnauthorizedException } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { RolesGuard } from './roles.guard.js';

describe('RolesGuard', () => {
  let guard: RolesGuard;
  let reflector: Reflector;

  beforeEach(() => {
    reflector = new Reflector();
    guard = new RolesGuard(reflector);
  });

  function createMockContext(odontologoActual?: { odontologoId: string; roles?: string[] }): ExecutionContext {
    const request = {
      odontologoActual,
    };
    return {
      getHandler: vi.fn(),
      getClass: vi.fn(),
      switchToHttp: () => ({
        getRequest: () => request,
        getResponse: () => ({}),
        getNext: () => ({}),
      }),
    } as unknown as ExecutionContext;
  }

  it('permite el acceso si la ruta no tiene roles requeridos', () => {
    vi.spyOn(reflector, 'getAllAndOverride').mockReturnValue(undefined);
    const context = createMockContext();
    expect(guard.canActivate(context)).toBe(true);
  });

  it('arroja UnauthorizedException si requiere roles pero no hay usuario autenticado', () => {
    vi.spyOn(reflector, 'getAllAndOverride').mockReturnValue(['ODONTOLOGO']);
    const context = createMockContext(undefined);
    expect(() => guard.canActivate(context)).toThrow(UnauthorizedException);
  });

  it('arroja ForbiddenException si el usuario no tiene los roles requeridos ni ADMIN', () => {
    vi.spyOn(reflector, 'getAllAndOverride').mockReturnValue(['ODONTOLOGO']);
    const context = createMockContext({
      odontologoId: 'od-1',
      roles: ['RECEPCIONISTA'],
    });
    expect(() => guard.canActivate(context)).toThrow(ForbiddenException);
  });

  it('permite el acceso si el usuario tiene el rol requerido', () => {
    vi.spyOn(reflector, 'getAllAndOverride').mockReturnValue(['ODONTOLOGO']);
    const context = createMockContext({
      odontologoId: 'od-1',
      roles: ['ODONTOLOGO'],
    });
    expect(guard.canActivate(context)).toBe(true);
  });

  it('permite el acceso si el usuario tiene rol ADMIN aunque requiera ODONTOLOGO', () => {
    vi.spyOn(reflector, 'getAllAndOverride').mockReturnValue(['ODONTOLOGO']);
    const context = createMockContext({
      odontologoId: 'admin-1',
      roles: ['ADMIN'],
    });
    expect(guard.canActivate(context)).toBe(true);
  });
});
