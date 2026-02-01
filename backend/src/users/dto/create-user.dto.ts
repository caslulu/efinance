import { Transform } from 'class-transformer';

export class CreateUserDto {
  @Transform(({ value }) => value.toLowerCase())
  username: string;
  @Transform(({ value }) => value.toLowerCase())
  email: string;
  password: string;
}
