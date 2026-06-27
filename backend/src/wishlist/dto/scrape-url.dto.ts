import { IsNotEmpty, IsString } from 'class-validator';

export class ScrapeUrlDto {
  @IsString()
  @IsNotEmpty()
  url: string;
}
