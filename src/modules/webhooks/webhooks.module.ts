import { Module } from '@nestjs/common';
import { WebhookController } from './webhooks.controller';
import { WebhookService } from './webhooks.service';
import { WebhookGuard } from './webhook.guard';
import { ChatbotModule } from '../chatbot/chatbot.module';
import { WebsocketModule } from '../websocket/websocket.module';

@Module({
  imports: [ChatbotModule, WebsocketModule],
  controllers: [WebhookController],
  providers: [WebhookService, WebhookGuard],
})
export class WebhooksModule {}
