import { Test, TestingModule } from '@nestjs/testing';
import { ChatbotService } from './chatbot.service';
import { PrismaService } from '../../database/prisma.service';
import { AiService } from '../ai-services/ai-services.service';
import { getQueueToken } from '@nestjs/bullmq';

describe('ChatbotService', () => {
  let service: ChatbotService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        ChatbotService,
        { provide: PrismaService, useValue: {} },
        { provide: AiService, useValue: {} },
        { provide: getQueueToken('chatbot-message'), useValue: { add: jest.fn() } },
      ],
    }).compile();

    service = module.get<ChatbotService>(ChatbotService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });
});
