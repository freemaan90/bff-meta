import { Controller, Get, Post, Query, Body, UseGuards } from '@nestjs/common';
import { WebhookService } from './webhooks.service';
import { WebhookGuard } from './webhook.guard';

@Controller('webhook')
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

  // Recepción de eventos — protegido con verificación de firma HMAC-SHA256
  @Post()
  @UseGuards(WebhookGuard)
  handleWebhook(@Body() body: any) {
    return this.webhookService.handleWebhook(body);
  }
}
