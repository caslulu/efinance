import { IsString, IsNotEmpty, IsNumber, IsBoolean, IsOptional } from 'class-validator';

export class LoginTwoFactorDto {
  @IsNumber()
  @IsNotEmpty()
  userId: number;

  @IsString()
  @IsNotEmpty()
  token: string;

  @IsBoolean()
  @IsOptional()
  rememberMe?: boolean;
}
