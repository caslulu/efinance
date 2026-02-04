import { IsNumber, IsString, IsNotEmpty } from 'class-validator';

export class VerifyEmailDto {
  @IsNumber()
  @IsNotEmpty()
  userId: number;

  @IsString()
  @IsNotEmpty()
  token: string;
}
