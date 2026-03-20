import { Processor, WorkerHost } from '@nestjs/bullmq';
import { Job } from 'bullmq';
import { WhatsappCoreService } from 'src/modules/whatsapp-core/whatsapp-core.service';

@Processor('send-message')
export class SendMessageProcessor extends WorkerHost {
  constructor(private readonly whatsapp: WhatsappCoreService) {
    super();
  }

  async process(job: Job) {
    const { tenantId, campaignId, phone, variables } = job.data;

    await this.whatsapp.sendTemplate({
      tenantId,
      phone,
      template: job.data.template,
      language: job.data.language,
      variables,
    });

    return true;
  }
}
