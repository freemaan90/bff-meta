import { Module } from '@nestjs/common';
import { WebhookController } from './webhooks.controller';
import { WebhookService } from './webhooks.service';

@Module({
  controllers: [WebhookController],
  providers: [WebhookService],
})
export class WebhooksModule {}
