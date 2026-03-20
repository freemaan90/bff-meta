import { Test, TestingModule } from '@nestjs/testing';
import { WhatsappCoreService } from './whatsapp-core.service';

describe('WhatsappCoreService', () => {
  let service: WhatsappCoreService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [WhatsappCoreService],
    }).compile();

    service = module.get<WhatsappCoreService>(WhatsappCoreService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });
});
