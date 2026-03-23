import { HttpException, HttpStatus, Injectable } from '@nestjs/common';
import { PrismaService } from '../../database/prisma.service';
import { CreateCampaignDto } from './dto/create-campaign.dto';
import { InjectQueue } from '@nestjs/bullmq';
import { Queue } from 'bullmq';
import { Observable } from 'rxjs';
import { MessageEvent } from '@nestjs/common';
import { PhoneValidator } from '../../common/phone-validator';

@Injectable()
export class CampaignsService {
  constructor(
    private readonly prisma: PrismaService,
    @InjectQueue('send-message') private readonly sendMessageQueue: Queue,
  ) {}

  async createCampaign(tenantId: string, dto: CreateCampaignDto) {
    // 1. Validate all phone numbers before doing anything
    const normalizedContacts = dto.contacts.map((contact) => {
      try {
        const normalizedPhone = PhoneValidator.validateOrThrow(contact.phone);
        return { ...contact, phone: normalizedPhone };
      } catch {
        throw new HttpException(
          `Invalid phone number: "${contact.phone}". Must be in E.164 format (e.g. +5491112345678)`,
          HttpStatus.UNPROCESSABLE_ENTITY,
        );
      }
    });

    // 2. Crear campaña
    const campaign = await this.prisma.campaign.create({
      data: {
        tenantId,
        template: dto.template,
        language: dto.language,
        total: normalizedContacts.length,
      },
    });

    // 3. Crear mensajes en DB y encolar con messageDbId
    for (const contact of normalizedContacts) {
      const message = await this.prisma.message.create({
        data: {
          tenantId,
          campaignId: campaign.id,
          phone: contact.phone,
          variables: contact.variables ?? {},
        },
      });

      await this.sendMessageQueue.add('send', {
        tenantId,
        campaignId: campaign.id,
        phone: contact.phone,
        template: dto.template,
        language: dto.language,
        variables: contact.variables ?? {},
        messageDbId: message.id,
      });
    }

    return {
      campaignId: campaign.id,
      totalQueued: normalizedContacts.length,
    };
  }

  streamProgress(campaignId: string): Observable<MessageEvent> {
    return new Observable((subscriber) => {
      const interval = setInterval(async () => {
        const campaign = await this.prisma.campaign.findUnique({
          where: { id: campaignId },
        });

        if (!campaign) return;

        const sent = campaign.sentCount ?? 0;
        const failed = campaign.failedCount ?? 0;
        const total = campaign.total ?? 0;

        const progress =
          total > 0 ? Math.round((sent / total) * 100) : 0;

        subscriber.next({
          data: {
            status: campaign.status,
            sent,
            failed,
            total,
            progress,
          },
        });
      }, 1000);

      return () => clearInterval(interval);
    });
  }
}
