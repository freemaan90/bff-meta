import { IsNotEmpty, IsObject, IsOptional, IsString } from 'class-validator';

export class SendTemplateDto {
  @IsString()
  @IsNotEmpty()
  phone: string;

  @IsString()
  @IsNotEmpty()
  template: string;

  @IsString()
  @IsNotEmpty()
  language: string;

  @IsOptional()
  @IsObject()
  variables?: Record<string, string>;
}
