import { Inject, Injectable } from '@nestjs/common';
import {
  CONSULTA_ODONTOLOGICA_REPOSITORY,
  type IConsultaOdontologicaRepositoryPort,
} from '../../domain/ports/consulta-odontologica.repository.port.js';
import {
  ODONTOLOGO_CONTEXT_PORT,
  type IOdontologoContextPort,
} from '../../domain/ports/odontologo-context.port.js';
import {
  CATALOGO_SERVICIOS_PORT,
  type ICatalogoServiciosPort,
} from '../ports/catalogo-servicios.port.js';
import { ConsultaId } from '../../domain/value-objects/consulta-id.vo.js';
import { OdontologoId } from '../../domain/value-objects/odontologo-id.vo.js';
import { ServicioFacturableConsulta } from '../../domain/value-objects/servicio-facturable-consulta.vo.js';
import { ConsultaNoEncontradaError } from '../../domain/errors/consulta-no-encontrada.error.js';
import { ConflictoConcurrenteConsultaError } from '../../domain/errors/conflicto-concurrente-consulta.error.js';
import { ServicioFacturableInvalidoError } from '../../domain/errors/servicio-facturable-invalido.error.js';
import { AutenticacionRequeridaError } from '../errors/autenticacion-requerida.error.js';
import { ConsultaOdontologicaMapper } from '../mappers/consulta-odontologica.mapper.js';
import type { CompletarConsultaCommand } from '../commands/completar-consulta.command.js';
import type { ConsultaOdontologicaResponseDto } from '../dtos/consulta-odontologica-response.dto.js';

@Injectable()
export class CompletarConsultaUseCase {
  constructor(
    @Inject(CONSULTA_ODONTOLOGICA_REPOSITORY)
    private readonly consultaRepository: IConsultaOdontologicaRepositoryPort,
    @Inject(ODONTOLOGO_CONTEXT_PORT)
    private readonly odontologoContextPort: IOdontologoContextPort,
    @Inject(CATALOGO_SERVICIOS_PORT)
    private readonly catalogoServiciosPort: ICatalogoServiciosPort,
  ) {}

  async execute(
    command: CompletarConsultaCommand,
    ahora: Date = new Date(),
  ): Promise<ConsultaOdontologicaResponseDto> {
    if (!command.tokenAutenticacion?.trim()) {
      throw new AutenticacionRequeridaError(
        'Se requiere un token de autenticación válido para completar la consulta.',
      );
    }

    // 1. Resolver actor autenticado
    const contexto = await this.odontologoContextPort.obtenerOdontologoActual(
      command.tokenAutenticacion,
    );
    const odontologoId = OdontologoId.crear(contexto.odontologoId);

    // 2. Recuperar la consulta existente
    const consultaId = ConsultaId.reconstituir(command.consultaId);
    const consulta = await this.consultaRepository.buscarPorId(consultaId);
    if (!consulta) {
      throw new ConsultaNoEncontradaError(command.consultaId);
    }

    // 3. Verificación de concurrencia optimista en memoria (INV-CONS-09)
    if (consulta.version !== command.versionEsperada) {
      throw new ConflictoConcurrenteConsultaError(
        command.consultaId,
        command.versionEsperada,
      );
    }

    // 4. Validar servicios facturables contra el catálogo oficial de MS1 y congelar precios oficiales
    const serviciosFacturablesDomain: ServicioFacturableConsulta[] = [];

    if (command.serviciosFacturables && command.serviciosFacturables.length > 0) {
      for (const item of command.serviciosFacturables) {
        if (!item.servicioId?.trim()) {
          throw new ServicioFacturableInvalidoError('El servicioId es obligatorio.');
        }

        const servicioCatalogo =
          await this.catalogoServiciosPort.obtenerServicioPorId(item.servicioId);

        if (!servicioCatalogo) {
          throw new ServicioFacturableInvalidoError(
            `El servicio facturable con ID '${item.servicioId}' no existe en el catálogo maestro de MS1.`,
          );
        }

        if (!servicioCatalogo.activo) {
          throw new ServicioFacturableInvalidoError(
            `El servicio facturable '${servicioCatalogo.nombre}' (${item.servicioId}) se encuentra inactivo en MS1 y no puede ser facturado.`,
          );
        }

        serviciosFacturablesDomain.push(
          ServicioFacturableConsulta.crear({
            servicioId: item.servicioId,
            codigo: servicioCatalogo.codigo,
            nombre: servicioCatalogo.nombre,
            cantidad: item.cantidad,
            precioUnitarioBs: servicioCatalogo.precioBaseBs,
            piezaDental: item.piezaDental,
          }),
        );
      }
    }

    // 5. Completar en el aggregate root (valida invariantes INV-CONS-04 e INV-CONS-05 y sella el registro)
    // NOTA DE ARQUITECTURA:
    // - Si serviciosFacturables está vacío, la consulta queda COMPLETADA válidamente como consulta sin cobro.
    // - En la Iteración 4 se implementará Transactional Outbox para publicar el mensaje plano a RabbitMQ.
    consulta.completar(
      odontologoId,
      {
        serviciosFacturables: serviciosFacturablesDomain,
        observacionesCobro: command.observacionesCobro,
        ahora,
      },
      ahora,
    );

    // 6. Persistir con concurrencia optimista
    await this.consultaRepository.actualizar(consulta, command.versionEsperada);

    return ConsultaOdontologicaMapper.toResponseDto(consulta);
  }
}
