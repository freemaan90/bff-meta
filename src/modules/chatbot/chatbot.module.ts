import { Module } from '@nestjs/common';
import { ChatbotService } from './chatbot.service';
import { BullModule } from '@nestjs/bullmq';
import { PrismaService } from 'src/database/prisma.service';
import { AiService } from '../ai-services/ai-services.service';

@Module({
  imports: [
    BullModule.registerQueue({
      name: 'send-message',
    }),
    BullModule.registerQueue({
      name: 'chatbot-message',
    }),
  ],
  providers: [ChatbotService, PrismaService, AiService],
  exports: [ChatbotService],
})
export class ChatbotModule {}
