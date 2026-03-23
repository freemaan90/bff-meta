import { Module } from '@nestjs/common';
import { WhatsappCoreService } from './whatsapp-core.service';
import { WhatsappCoreController } from './whatsapp-core.controller';
import { MetaModule } from '../../integrations/meta/meta.module';

@Module({
  imports: [MetaModule],
  controllers: [WhatsappCoreController],
  providers: [WhatsappCoreService],
})
export class WhatsappCoreModule {}
