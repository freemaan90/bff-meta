import { Module } from '@nestjs/common';
import { MetaModule } from '../../integrations/meta/meta.module';
import { AuthModule } from '../auth/auth.module';
import { MediaService } from './media.service';
import { MessagesController } from './messages.controller';
import { MessagesService } from './messages.service';

@Module({
  imports: [MetaModule, AuthModule],
  controllers: [MessagesController],
  providers: [MessagesService, MediaService],
  exports: [MessagesService],
})
export class MessagesModule {}
