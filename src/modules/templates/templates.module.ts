import { Module } from '@nestjs/common';
import { MetaModule } from '../../integrations/meta/meta.module';
import { AuthModule } from '../auth/auth.module';
import { TemplateManager } from './template-manager.service';
import { TemplatesController } from './templates.controller';

@Module({
  imports: [MetaModule, AuthModule],
  controllers: [TemplatesController],
  providers: [TemplateManager],
  exports: [TemplateManager],
})
export class TemplatesModule {}
