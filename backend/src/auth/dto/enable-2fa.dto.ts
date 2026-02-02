import { IsString, IsNotEmpty } from 'class-validator';

export class EnableTwoFactorDto {
  @IsString()
  @IsNotEmpty()
  token: string;
}
