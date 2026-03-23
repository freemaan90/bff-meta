import { IsNotEmpty, IsString } from 'class-validator';

export class SendTextDto {
  @IsString()
  @IsNotEmpty()
  phone: string;

  @IsString()
  @IsNotEmpty()
  text: string;
}
