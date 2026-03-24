export class ChatItemDto {
  id: string;
  lastMessageAt: Date;
  messageCount: number;
}

export class ChatListResponseDto {
  data: ChatItemDto[];
  meta: {
    total: number;
    page: number;
    limit: number;
    totalPages: number;
  };
}
