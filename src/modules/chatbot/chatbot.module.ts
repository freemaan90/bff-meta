import { Module } from '@nestjs/common';
import { ChatbotService } from './chatbot.service';
import { BullModule } from '@nestjs/bullmq';
import { PrismaService } from 'src/database/prisma.service';

@Module({
  imports: [
    BullModule.registerQueue({
      name: 'send-message',
    }),
  ],
  providers: [ChatbotService, PrismaService],
  exports: [ChatbotService],
})
export class ChatbotModule {}
