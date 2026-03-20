import { Controller, Get, Post, Query, Body } from '@nestjs/common';
import { WebhookService } from './webhooks.service';

@Controller('webhooks')
export class WebhookController {
  constructor(private readonly webhookService: WebhookService) {}

  // Validación del webhook (Meta challenge)
  @Get()
  verifyWebhooks(
    @Query('hub.mode') mode: string,
    @Query('hub.verify_token') token: string,
    @Query('hub.challenge') challenge: string,
  ) {
    return this.webhookService.verifyWebhook(mode, token, challenge);
  }

  // Recepción de eventos
  @Post()
  handleWebhook(@Body() body: any) {
    return this.webhookService.handleWebhook(body);
  }
}
