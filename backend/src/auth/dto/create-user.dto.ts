import { IsString, IsNotEmpty, MinLength, MaxLength, Matches, IsEmail, IsOptional } from 'class-validator';
import { Transform } from 'class-transformer';

export class CreateUserDto {
  @IsString()
  @IsNotEmpty({ message: 'O nome de usuário é obrigatório.' })
  @MinLength(3, { message: 'O nome de usuário deve ter pelo menos 3 caracteres.' })
  @MaxLength(32, { message: 'O nome de usuário deve ter no máximo 32 caracteres.' })
  @Matches(/^[a-zA-Z0-9_]+$/, { message: 'O nome de usuário deve conter apenas letras, números e sublinhados (_).' })
  @Transform(({ value }) => value.toLowerCase())
  username: string;

  @IsEmail({}, { message: 'Endereço de email inválido.' })
  @IsNotEmpty({ message: 'O email é obrigatório.' })
  @Transform(({ value }) => value.toLowerCase())
  email: string;

  @IsString()
  @IsNotEmpty({ message: 'A senha é obrigatória.' })
  @MinLength(8, { message: 'A senha deve ter pelo menos 8 caracteres.' })
  @MaxLength(32, { message: 'A senha deve ter no máximo 32 caracteres.' })
  @Matches(/((?=.*\d)|(?=.*\W+))(?![.\n])(?=.*[A-Z])(?=.*[a-z]).*$/, { message: 'A senha deve conter pelo menos uma letra maiúscula, uma minúscula e um número ou caractere especial.' })
  password: string;

  @IsString()
  @IsOptional()
  registerToken?: string;
}
