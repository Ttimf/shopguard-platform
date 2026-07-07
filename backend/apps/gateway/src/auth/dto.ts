import { IsEmail, IsString, MinLength, IsOptional } from 'class-validator';

export class RegisterHttpDto {
  @IsEmail()
  email: string;

  @IsString()
  @MinLength(6, { message: 'Пароль минимум 6 символов' })
  password: string;

  @IsOptional()
  @IsString()
  name?: string;
}

export class LoginHttpDto {
  @IsEmail()
  email: string;

  @IsString()
  password: string;
}

export class RefreshHttpDto {
  @IsString()
  refreshToken: string;
}
