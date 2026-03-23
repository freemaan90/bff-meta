import { Module } from '@nestjs/common';
import { WebhookController } from './webhooks.controller';
import { WebhookService } from './webhooks.service';
import { WebhookGuard } from './webhook.guard';
import { ChatbotModule } from '../chatbot/chatbot.module';

@Module({
  imports:[ChatbotModule],
  controllers: [WebhookController],
  providers: [WebhookService, WebhookGuard],
})
export class WebhooksModule {}
