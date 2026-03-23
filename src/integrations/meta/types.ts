export interface MetaSendTextParams {
  accessToken: string;
  phoneNumberId: string;
  to: string;
  text: string;
}

export interface MetaSendTemplateParams {
  accessToken: string;
  phoneNumberId: string;
  to: string;
  template: string;
  language: string;
  variables?: Record<string, string>;
}

export interface MetaSendMediaParams {
  accessToken: string;
  phoneNumberId: string;
  to: string;
  mediaType: 'image' | 'document' | 'audio' | 'video';
  mediaUrl: string;
  caption?: string;
  filename?: string;
}

export interface MetaSendResult {
  messageId: string;
}

export interface MetaTemplate {
  id: string;
  name: string;
  status: string;
  language: string;
}

export interface MetaTemplateResult {
  id: string;
  status: string;
}

export interface CreateTemplateDto {
  name: string;
  language: string;
  category: string;
  components?: unknown[];
}
