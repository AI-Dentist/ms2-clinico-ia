import { ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { IsArray, IsOptional, ValidateNested } from 'class-validator';
import { CampoClinicoHttpDto } from './campo-clinico.http-dto.js';

export class AntecedentesOdontologicosHttpDto {
  @ApiPropertyOptional({ type: CampoClinicoHttpDto })
  @IsOptional()
  @ValidateNested()
  @Type(() => CampoClinicoHttpDto)
  tratamientoPrevio?: CampoClinicoHttpDto;

  @ApiPropertyOptional({ type: CampoClinicoHttpDto })
  @IsOptional()
  @ValidateNested()
  @Type(() => CampoClinicoHttpDto)
  protesisActual?: CampoClinicoHttpDto;

  @ApiPropertyOptional({ type: CampoClinicoHttpDto })
  @IsOptional()
  @ValidateNested()
  @Type(() => CampoClinicoHttpDto)
  sangradoGingival?: CampoClinicoHttpDto;

  @ApiPropertyOptional({ type: CampoClinicoHttpDto })
  @IsOptional()
  @ValidateNested()
  @Type(() => CampoClinicoHttpDto)
  bruxismo?: CampoClinicoHttpDto;
}

export class AntecedentesHttpDto {
  @ApiPropertyOptional({ type: [CampoClinicoHttpDto] })
  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => CampoClinicoHttpDto)
  enfermedadesCronicas?: CampoClinicoHttpDto[];

  @ApiPropertyOptional({ type: [CampoClinicoHttpDto] })
  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => CampoClinicoHttpDto)
  antecedentesMedicos?: CampoClinicoHttpDto[];

  @ApiPropertyOptional({ type: [CampoClinicoHttpDto] })
  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => CampoClinicoHttpDto)
  antecedentesFamiliares?: CampoClinicoHttpDto[];

  @ApiPropertyOptional({ type: AntecedentesOdontologicosHttpDto })
  @IsOptional()
  @ValidateNested()
  @Type(() => AntecedentesOdontologicosHttpDto)
  antecedentesOdontologicos?: AntecedentesOdontologicosHttpDto;
}
