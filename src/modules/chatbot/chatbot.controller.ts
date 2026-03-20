import { Body, Controller, Param, Patch } from '@nestjs/common';
import { ChatbotService } from './chatbot.service';
import { UpdateChatbotDto } from './dto/update-chatbot.dto';
import { TenantsService } from '../tenants/tenants.service';

@Controller('chatbot')
export class ChatbotController {
  constructor(
    private readonly tenantsService: TenantsService
  ) {}

  @Patch(':id/chatbot')
  async updateChatbot(@Param('id') id: string, @Body() dto: UpdateChatbotDto) {
    return this.tenantsService.updateChatbot(id, dto);
  }
}
