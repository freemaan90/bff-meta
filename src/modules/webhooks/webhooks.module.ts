import { Module } from '@nestjs/common';
import { WebhookController } from './webhooks.controller';
import { WebhookService } from './webhooks.service';
import { ChatbotModule } from '../chatbot/chatbot.module';

@Module({
  imports:[ChatbotModule],
  controllers: [WebhookController],
  providers: [WebhookService],
})
export class WebhooksModule {}
