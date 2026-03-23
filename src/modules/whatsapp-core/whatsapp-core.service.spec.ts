import { Test, TestingModule } from '@nestjs/testing';
import { WhatsappCoreService } from './whatsapp-core.service';
import { PrismaService } from '../../database/prisma.service';
import { MetaClient } from '../../integrations/meta/meta.client';

describe('WhatsappCoreService', () => {
  let service: WhatsappCoreService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        WhatsappCoreService,
        { provide: PrismaService, useValue: {} },
        { provide: MetaClient, useValue: {} },
      ],
    }).compile();

    service = module.get<WhatsappCoreService>(WhatsappCoreService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });
});
