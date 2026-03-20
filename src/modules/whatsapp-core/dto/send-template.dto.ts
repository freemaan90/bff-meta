import {
  IsString,
  IsNotEmpty,
  IsOptional,
  IsObject,
} from 'class-validator';

export class SendTemplateDto {
  @IsString()
  @IsNotEmpty()
  tenantId: string;

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
  variables?: Record<string, any>;
}