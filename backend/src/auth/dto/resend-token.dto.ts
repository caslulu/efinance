import { IsNumber, IsNotEmpty } from 'class-validator';

export class ResendTokenDto {
  @IsNumber()
  @IsNotEmpty()
  userId: number;
}
