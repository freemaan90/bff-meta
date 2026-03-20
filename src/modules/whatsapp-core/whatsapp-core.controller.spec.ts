import { Test, TestingModule } from '@nestjs/testing';
import { WhatsappCoreController } from './whatsapp-core.controller';
import { WhatsappCoreService } from './whatsapp-core.service';

describe('WhatsappCoreController', () => {
  let controller: WhatsappCoreController;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [WhatsappCoreController],
      providers: [WhatsappCoreService],
    }).compile();

    controller = module.get<WhatsappCoreController>(WhatsappCoreController);
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });
});
