import { Module } from '@nestjs/common';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { PrismaModule } from './database/prisma.module';
import { AuthModule } from './modules/auth/auth.module';
import { HealthModule } from './health/health.module';
import { TenantsModule } from './modules/tenants/tenants.module';
import { WhatsappCoreModule } from './modules/whatsapp-core/whatsapp-core.module';
import { WebhooksModule } from './modules/webhooks/webhooks.module';
import { CampaignsModule } from './modules/campaigns/campaigns.module';
import { ChatbotModule } from './modules/chatbot/chatbot.module';
import { MessagesModule } from './modules/messages/messages.module';
import { TemplatesModule } from './modules/templates/templates.module';
import { BullmqModule } from './workers/bullmq.module';
import { ConfigModule } from '@nestjs/config';
import { validationSchema } from './config/config.validation';

@Module({
  imports: [
    PrismaModule,
    AuthModule,
    HealthModule,
    TenantsModule,
    WhatsappCoreModule,
    WebhooksModule,
    CampaignsModule,
    ChatbotModule,
    MessagesModule,
    TemplatesModule,
    BullmqModule,
    ConfigModule.forRoot({
      isGlobal: true,
      validationSchema,
    }),
  ],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule {}
