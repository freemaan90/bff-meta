import {
  IsString,
  IsNotEmpty,
  IsArray,
  ValidateNested,
  IsOptional,
  IsObject,
} from 'class-validator';
import { Type } from 'class-transformer';

class ContactDto {
  @IsString()
  @IsNotEmpty()
  phone: string;

  @IsOptional()
  @IsObject()
  variables?: Record<string, any>;
}

export class CreateCampaignDto {
  @IsString()
  @IsNotEmpty()
  template: string;

  @IsString()
  @IsNotEmpty()
  language: string;

  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => ContactDto)
  contacts: ContactDto[];
}