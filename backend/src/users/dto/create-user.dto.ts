import { Transform } from 'class-transformer';
import { IsString, IsOptional, IsDateString } from 'class-validator';

export class CreateUserDto {
  @Transform(({ value }) => value.toLowerCase())
  username: string;
  @Transform(({ value }) => value.toLowerCase())
  email: string;
  password: string;

  @IsString()
  @IsOptional()
  fullName?: string;

  @IsDateString()
  @IsOptional()
  birthDate?: string;

  @IsString()
  @IsOptional()
  avatarUrl?: string;
}
