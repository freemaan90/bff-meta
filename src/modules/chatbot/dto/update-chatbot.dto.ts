import { IsBoolean, IsOptional, IsString, IsArray } from 'class-validator';

export class UpdateChatbotDto {
  @IsOptional()
  @IsBoolean()
  chatbotEnabled?: boolean;

  @IsOptional()
  @IsString()
  chatbotMode?: 'rules' | 'ai' | 'hybrid';

  @IsOptional()
  @IsArray()
  chatbotRules?: { contains: string; reply: string }[];

  @IsOptional()
  @IsString()
  chatbotPrompt?: string;
}
