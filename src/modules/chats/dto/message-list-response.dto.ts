export class MessageItemDto {
  id: string;
  direction: 'inbound' | 'outbound';
  type: string;
  text?: string;
  status?: string;
  createdAt: Date;
}

export class MessageListResponseDto {
  data: MessageItemDto[];
  meta: {
    total: number;
    page: number;
    limit: number;
    totalPages: number;
  };
}
