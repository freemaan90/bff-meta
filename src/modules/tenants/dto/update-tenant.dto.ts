import { IsOptional, IsString } from 'class-validator';

export class UpdateTenantDto {
  @IsString()
  @IsOptional()
  name?: string;
  @IsString()
  @IsOptional()
  wabaId?: string;
  @IsString()
  @IsOptional()
  phoneNumberId?: string;
  @IsString()
  @IsOptional()
  accessToken?: string;
}
