import { IsNotEmpty, IsString } from 'class-validator';

export class CreateTenantDto {
  @IsString()
  @IsNotEmpty()
  name: string;
  @IsString()
  @IsNotEmpty()
  wabaId?: string;
  @IsString()
  @IsNotEmpty()
  phoneNumberId?: string;
  @IsString()
  @IsNotEmpty()
  accessToken?: string;
}
