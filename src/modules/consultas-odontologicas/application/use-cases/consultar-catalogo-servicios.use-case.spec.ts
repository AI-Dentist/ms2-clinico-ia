import { describe, it, expect, vi, beforeEach } from 'vitest';
import { ConsultarCatalogoServiciosUseCase } from './consultar-catalogo-servicios.use-case.js';
import type { ICatalogoServiciosPort, ServicioCatalogoDto } from '../ports/catalogo-servicios.port.js';
import { ServicioCatalogoNoEncontradoError } from '../errors/servicio-catalogo-no-encontrado.error.js';

describe('ConsultarCatalogoServiciosUseCase', () => {
  let useCase: ConsultarCatalogoServiciosUseCase;
  let mockPort: { [K in keyof ICatalogoServiciosPort]: ReturnType<typeof vi.fn> };

  const mockServicio: ServicioCatalogoDto = {
    id: '550e8400-e29b-41d4-a716-446655440001',
    codigo: 'LIM-001',
    nombre: 'Limpieza Dental Ultrasonido',
    descripcion: 'Profilaxis dental',
    precioBaseBs: '150.00',
    activo: true,
  };

  beforeEach(() => {
    mockPort = {
      listarServiciosActivos: vi.fn().mockResolvedValue([mockServicio]),
      obtenerServicioPorId: vi.fn().mockImplementation((id: string) => {
        if (id === mockServicio.id) return Promise.resolve(mockServicio);
        return Promise.resolve(null);
      }),
    };

    useCase = new ConsultarCatalogoServiciosUseCase(
      mockPort as unknown as ICatalogoServiciosPort,
    );
  });

  it('1. Debe listar servicios activos delegando al puerto de catálogo', async () => {
    const servicios = await useCase.listar('60000000-0000-0000-0000-000000000010');

    expect(servicios).toEqual([mockServicio]);
    expect(mockPort.listarServiciosActivos).toHaveBeenCalledWith(
      '60000000-0000-0000-0000-000000000010',
    );
  });

  it('2. Debe obtener un servicio por ID cuando existe en el catálogo', async () => {
    const servicio = await useCase.obtenerPorId(mockServicio.id);

    expect(servicio).toEqual(mockServicio);
    expect(mockPort.obtenerServicioPorId).toHaveBeenCalledWith(mockServicio.id);
  });

  it('3. Debe lanzar ServicioCatalogoNoEncontradoError si el servicio no existe', async () => {
    await expect(useCase.obtenerPorId('uuid-no-existente')).rejects.toThrow(
      ServicioCatalogoNoEncontradoError,
    );
    expect(mockPort.obtenerServicioPorId).toHaveBeenCalledWith('uuid-no-existente');
  });
});
