import { Controller, HttpCode, HttpStatus, Post } from '@nestjs/common';
import { ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';

export interface LegacyRetiredEndpointResponse {
  readonly error: 'LEGACY_MODEL_RETIRED';
  readonly detail: 'The untrained CNN endpoint was retired; use the trained detector.';
  readonly replacement: '/api/expediente/estudios/analizar-imagen';
}

export const LEGACY_RETIRED_RESPONSE: LegacyRetiredEndpointResponse = Object.freeze({
  error: 'LEGACY_MODEL_RETIRED',
  detail: 'The untrained CNN endpoint was retired; use the trained detector.',
  replacement: '/api/expediente/estudios/analizar-imagen',
});

@ApiTags('Inteligencia Artificial y Diagnóstico')
@Controller('ia')
export class IaDiagnosticoController {
  @Post('analizar-radiografia')
  @HttpCode(HttpStatus.GONE)
  @ApiOperation({
    summary: 'Endpoint retirado: CNN con pesos aleatorios',
    description:
      'El modelo CNN no entrenado fue retirado. Utilice el detector entrenado en /api/expediente/estudios/analizar-imagen.',
    deprecated: true,
  })
  @ApiResponse({
    status: HttpStatus.GONE,
    description: 'Endpoint retirado (HTTP 410 Gone).',
    schema: {
      example: LEGACY_RETIRED_RESPONSE,
    },
  })
  analizarRadiografia(): LegacyRetiredEndpointResponse {
    return LEGACY_RETIRED_RESPONSE;
  }
}
