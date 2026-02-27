import { IsNotEmpty, IsString, IsUrl } from 'class-validator';

export class ScrapeUrlDto {
  @IsString()
  @IsNotEmpty()
  url: string;
}
