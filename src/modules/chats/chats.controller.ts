import { Controller, Get, Param, Query, Req, UseGuards } from '@nestjs/common';
import { ApiKeyGuard } from '../auth/guards/api-key.guard';
import { ChatsService } from './chats.service';
import { PaginationQueryDto } from './dto/pagination-query.dto';

@Controller('chats')
@UseGuards(ApiKeyGuard)
export class ChatsController {
  constructor(private readonly chatsService: ChatsService) {}

  @Get()
  listChats(@Req() req: { tenantId: string }, @Query() query: PaginationQueryDto) {
    return this.chatsService.listChats(req.tenantId, query.page ?? 1, query.limit ?? 20);
  }

  @Get(':id/messages')
  getChatMessages(
    @Req() req: { tenantId: string },
    @Param('id') id: string,
    @Query() query: PaginationQueryDto,
  ) {
    return this.chatsService.getChatMessages(req.tenantId, id, query.page ?? 1, query.limit ?? 20);
  }
}
