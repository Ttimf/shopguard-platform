import {
  IsArray,
  IsBoolean,
  IsIn,
  IsInt,
  IsNumber,
  IsOptional,
  IsString,
  Max,
  Min,
  MinLength,
  ValidateNested,
} from 'class-validator';
import { Type } from 'class-transformer';

export class CreateStoreHttpDto {
  @IsString()
  @MinLength(2)
  name: string;

  @IsOptional()
  @IsString()
  address?: string;
}

export class CreateCameraHttpDto {
  @IsString()
  @MinLength(2)
  name: string;

  @IsString()
  @MinLength(3)
  rtspUrl: string;

  @IsOptional()
  @IsString()
  username?: string;

  @IsOptional()
  @IsString()
  password?: string;

  @IsOptional()
  @IsString()
  description?: string;

  @IsOptional()
  @IsString()
  manufacturer?: string;

  @IsOptional()
  @IsString()
  model?: string;

  @IsOptional()
  @IsString()
  location?: string;

  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(60)
  fpsLimit?: number;
}

/** Плоский POST /api/cameras — storeId в теле. */
export class CreateCameraBodyDto extends CreateCameraHttpDto {
  @IsString()
  storeId: string;
}

export class UpdateCameraHttpDto {
  @IsOptional()
  @IsString()
  @MinLength(2)
  name?: string;

  @IsOptional()
  @IsBoolean()
  enabled?: boolean;

  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(60)
  fpsLimit?: number;

  @IsOptional()
  @IsString()
  @MinLength(3)
  rtspUrl?: string;

  @IsOptional()
  @IsString()
  username?: string;

  @IsOptional()
  @IsString()
  password?: string;

  @IsOptional()
  @IsString()
  description?: string;

  @IsOptional()
  @IsString()
  manufacturer?: string;

  @IsOptional()
  @IsString()
  model?: string;

  @IsOptional()
  @IsString()
  location?: string;
}

export class ZoneHttpDto {
  @IsIn(['SHELF', 'EXIT'])
  type: 'SHELF' | 'EXIT';

  @IsArray()
  polygon: number[][];
}

export class SetZonesHttpDto {
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => ZoneHttpDto)
  zones: ZoneHttpDto[];
}

export class SetTelegramHttpDto {
  @IsOptional()
  @IsString()
  chatId?: string;
}

export class SetModelHttpDto {
  @IsOptional()
  @IsString()
  model?: string; // пусто/отсутствует — вернуть модель по умолчанию
}

export class SetBehaviorHttpDto {
  @IsNumber()
  @Min(0)
  shelfDwellSeconds: number;

  @IsNumber()
  @Min(0)
  exitConfirmSeconds: number;

  @IsNumber()
  @Min(0)
  maxPersonLostSeconds: number;
}
