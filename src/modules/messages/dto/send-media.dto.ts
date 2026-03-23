import { IsEnum, IsNotEmpty, IsOptional, IsString, IsUrl } from 'class-validator';

export type MediaType = 'image' | 'document' | 'audio' | 'video';

export class SendMediaDto {
  @IsString()
  @IsNotEmpty()
  phone: string;

  @IsEnum(['image', 'document', 'audio', 'video'])
  mediaType: MediaType;

  @IsUrl({ protocols: ['https'], require_protocol: true })
  mediaUrl: string;

  @IsOptional()
  @IsString()
  caption?: string;

  @IsOptional()
  @IsString()
  filename?: string;
}
