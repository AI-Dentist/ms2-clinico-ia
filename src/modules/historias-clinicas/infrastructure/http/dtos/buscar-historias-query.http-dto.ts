import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsOptional, IsString } from 'class-validator';

export class BuscarHistoriasQueryHttpDto {
  @ApiPropertyOptional({
    description: 'Filtrar por identificador canónico del paciente',
    example: 'a1b2c3d4-e5f6-7a8b-9c0d-1e2f3a4b5c6d',
  })
  @IsString()
  @IsOptional()
  pacienteId?: string;
}
