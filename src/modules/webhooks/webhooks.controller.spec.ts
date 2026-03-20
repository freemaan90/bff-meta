import { Test, TestingModule } from '@nestjs/testing';
import { WebhookController } from './webhooks.controller';
import { WebhookService } from './webhooks.service';

describe('WebhooksController', () => {
  let controller: WebhooksController;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [WebhookController],
      providers: [WebhookService],
    }).compile();

    controller = module.get<WebhooksController>(WebhookController);
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });
});
