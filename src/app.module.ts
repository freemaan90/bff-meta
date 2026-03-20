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

@Module({
  imports: [
    PrismaModule,
    AuthModule,
    HealthModule,
    TenantsModule,
    WhatsappCoreModule,
    WebhooksModule,
    CampaignsModule
  ],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule {}
