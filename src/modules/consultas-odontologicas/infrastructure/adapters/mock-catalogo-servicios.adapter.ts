import { Injectable, Logger } from '@nestjs/common';
import type {
  ICatalogoServiciosPort,
  ServicioCatalogoDto,
} from '../../application/ports/catalogo-servicios.port.js';

/**
 * Adaptador de desarrollo y pruebas para ICatalogoServiciosPort.
 *
 * RESTRICCIÓN DE SEGURIDAD:
 * - Habilitado ÚNICAMENTE en entornos que NO sean 'production' (development / test).
 * - En producción, este puerto debe consultar el endpoint GraphQL de MS1.
 */
@Injectable()
export class MockCatalogoServiciosAdapter implements ICatalogoServiciosPort {
  private readonly logger = new Logger(MockCatalogoServiciosAdapter.name);

  private readonly catalogoSemilla: ServicioCatalogoDto[] = [
    {
      id: '55555555-5555-4555-8555-555555555551',
      codigo: 'LIMP-01',
      nombre: 'Limpieza Dental y Profilaxis',
      descripcion: 'Profilaxis dental completa con ultrasonido',
      precioBaseBs: '150.00',
      activo: true,
      especialidad: {
        id: '22222222-2222-4222-8222-222222222221',
        codigo: 'ODON-GEN',
        nombre: 'Odontología General',
        descripcion: 'Atención primaria y profilaxis',
        activo: true,
      },
    },
    {
      id: '55555555-5555-4555-8555-555555555552',
      codigo: 'REST-01',
      nombre: 'Restauración Resina Fotocurable',
      descripcion: 'Obturación con resina compuesta en pieza simple',
      precioBaseBs: '280.00',
      activo: true,
      especialidad: {
        id: '22222222-2222-4222-8222-222222222221',
        codigo: 'ODON-GEN',
        nombre: 'Odontología General',
        descripcion: 'Atención primaria y profilaxis',
        activo: true,
      },
    },
    {
      id: '55555555-5555-4555-8555-555555555553',
      codigo: 'ENDO-01',
      nombre: 'Tratamiento de Conducto Unirradicular',
      descripcion: 'Endodoncia completa en pieza anterior',
      precioBaseBs: '450.00',
      activo: true,
      especialidad: {
        id: '22222222-2222-4222-8222-222222222222',
        codigo: 'ENDO',
        nombre: 'Endodoncia',
        descripcion: 'Tratamiento de pulpa dental y conductos radiculares',
        activo: true,
      },
    },
  ];

  async listarServiciosActivos(especialidadId?: string): Promise<ServicioCatalogoDto[]> {
    if (process.env.NODE_ENV === 'production') {
      throw new Error(
        'CRÍTICO: MockCatalogoServiciosAdapter no está permitido en entornos de producción.',
      );
    }

    this.logger.debug(
      `Consultando catálogo simulado de servicios (especialidad: ${especialidadId ?? 'todas'}).`,
    );

    if (especialidadId) {
      const espIdLimpio = especialidadId.trim().toLowerCase();
      return this.catalogoSemilla.filter(
        (s) => s.activo && s.especialidad?.id.toLowerCase() === espIdLimpio,
      );
    }

    return this.catalogoSemilla.filter((s) => s.activo);
  }

  async obtenerServicioPorId(servicioId: string): Promise<ServicioCatalogoDto | null> {
    if (process.env.NODE_ENV === 'production') {
      throw new Error(
        'CRÍTICO: MockCatalogoServiciosAdapter no está permitido en entornos de producción.',
      );
    }

    const idLimpio = servicioId?.trim().toLowerCase();
    if (!idLimpio) {
      return null;
    }

    const encontrado = this.catalogoSemilla.find((s) => s.id.toLowerCase() === idLimpio);
    return encontrado ?? null;
  }
}

