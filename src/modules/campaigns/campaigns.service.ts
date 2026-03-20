import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../database/prisma.service';
import { CreateCampaignDto } from './dto/create-campaign.dto';
import { InjectQueue } from '@nestjs/bullmq';
import { Queue } from 'bullmq';

@Injectable()
export class CampaignsService {
  constructor(
    private readonly prisma: PrismaService,
    @InjectQueue('send-message') private readonly sendMessageQueue: Queue,
  ) {}

  async createCampaign(tenantId: string, dto: CreateCampaignDto) {
    // 1. Crear campaña
    const campaign = await this.prisma.campaign.create({
      data: {
        tenantId,
        template: dto.template,
        language: dto.language,
        total: dto.contacts.length,
      },
    });

    // 2. Crear mensajes
    const messages = await this.prisma.message.createMany({
      data: dto.contacts.map((c) => ({
        tenantId,
        campaignId: campaign.id,
        phone: c.phone,
        variables: c.variables ?? {},
      })),
    });

    // 3. Encolar mensajes
    for (const contact of dto.contacts) {
      await this.sendMessageQueue.add('send', {
        tenantId,
        campaignId: campaign.id,
        phone: contact.phone,
        variables: contact.variables ?? {},
      });
    }

    return {
      campaignId: campaign.id,
      totalQueued: dto.contacts.length,
    };
  }
}
