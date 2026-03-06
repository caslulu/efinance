import { IsString, IsOptional, IsInt, MinLength, MaxLength } from 'class-validator';

export class CreateMessageDto {
  @IsOptional()
  @IsInt()
  conversationId?: number;

  @IsString()
  @MinLength(1)
  @MaxLength(4000)
  message: string;
}
