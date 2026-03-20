import { Module } from '@nestjs/common';
import { WhatsappCoreService } from './whatsapp-core.service';
import { WhatsappCoreController } from './whatsapp-core.controller';

@Module({
  controllers: [WhatsappCoreController],
  providers: [WhatsappCoreService],
})
export class WhatsappCoreModule {}
