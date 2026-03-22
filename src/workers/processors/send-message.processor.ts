import { Processor, WorkerHost } from '@nestjs/bullmq';
import { Job } from 'bullmq';
import { PrismaService } from 'src/database/prisma.service';
import { CampaignStatus } from 'src/generated/enums';
import { WhatsappCoreService } from 'src/modules/whatsapp-core/whatsapp-core.service';

@Processor('send-message')
export class SendMessageProcessor extends WorkerHost {
  constructor(
    private readonly whatsapp: WhatsappCoreService,
    private readonly prisma: PrismaService,
  ) {
    super();
  }

  async process(job: Job) {
    const { tenantId, campaignId, phone, variables, template, language } = job.data;

    try {
      // 📤 Enviar mensaje
      await this.whatsapp.sendTemplate({
        tenantId,
        phone,
        template,
        language,
        variables,
      });

      // ✅ Actualizar mensaje
      await this.prisma.message.updateMany({
        where: { campaignId, phone },
        data: { status: 'SENT' },
      });

      // ✅ Incrementar contador
      await this.prisma.campaign.update({
        where: { id: campaignId },
        data: {
          sentCount: { increment: 1 },
        },
      });

    } catch (error) {
      // ❌ Error al enviar

      await this.prisma.message.updateMany({
        where: { campaignId, phone },
        data: { status: 'FAILED' },
      });

      await this.prisma.campaign.update({
        where: { id: campaignId },
        data: {
          failedCount: { increment: 1 },
        },
      });
    }

    // 🔁 Verificar si terminó la campaña
    await this.checkIfFinished(campaignId);

    return true;
  }

  private async checkIfFinished(campaignId: string) {
    const campaign = await this.prisma.campaign.findUnique({
      where: { id: campaignId },
    });

    if (!campaign) return;

    const processed = campaign.sentCount + campaign.failedCount;

    if (processed >= campaign.total) {
      await this.prisma.campaign.update({
        where: { id: campaignId },
        data: {
          status: CampaignStatus.FINISHED,
        },
      });
    }
  }
}