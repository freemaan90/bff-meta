import { Body, Controller, Post, Req, UseGuards } from '@nestjs/common';
import { ApiKeyGuard } from '../auth/guards/api-key.guard';
import { SendMediaDto } from './dto/send-media.dto';
import { SendTemplateDto } from './dto/send-template.dto';
import { SendTextDto } from './dto/send-text.dto';
import { MessagesService } from './messages.service';

@Controller('messages')
@UseGuards(ApiKeyGuard)
export class MessagesController {
  constructor(private readonly messagesService: MessagesService) {}

  @Post('text')
  sendText(@Req() req: { tenantId: string }, @Body() dto: SendTextDto) {
    return this.messagesService.sendText(req.tenantId, dto.phone, dto.text);
  }

  @Post('template')
  sendTemplate(@Req() req: { tenantId: string }, @Body() dto: SendTemplateDto) {
    return this.messagesService.sendTemplate(
      req.tenantId,
      dto.phone,
      dto.template,
      dto.language,
      dto.variables,
    );
  }

  @Post('media')
  sendMedia(@Req() req: { tenantId: string }, @Body() dto: SendMediaDto) {
    return this.messagesService.sendMedia(
      req.tenantId,
      dto.phone,
      dto.mediaType,
      dto.mediaUrl,
      dto.caption,
      dto.filename,
    );
  }
}
