import { Test, TestingModule } from '@nestjs/testing';
import { CampaignsController } from './campaigns.controller';
import { CampaignsService } from './campaigns.service';
import { ApiKeyGuard } from '../auth/guards/api-key.guard';
import { AuthService } from '../auth/auth.service';
import { PrismaService } from '../../database/prisma.service';
import { getQueueToken } from '@nestjs/bullmq';

describe('CampaignsController', () => {
  let controller: CampaignsController;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [CampaignsController],
      providers: [
        CampaignsService,
        ApiKeyGuard,
        { provide: AuthService, useValue: { validateApiKey: jest.fn() } },
        { provide: PrismaService, useValue: {} },
        { provide: getQueueToken('send-message'), useValue: { add: jest.fn() } },
      ],
    }).compile();

    controller = module.get<CampaignsController>(CampaignsController);
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });
});
