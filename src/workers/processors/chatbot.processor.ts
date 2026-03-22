import { Processor, WorkerHost } from '@nestjs/bullmq';
import { Job } from 'bullmq';
import { WhatsappCoreService } from 'src/modules/whatsapp-core/whatsapp-core.service';

@Processor('chatbot-message')
export class ChatbotProcessor extends WorkerHost {
  constructor(private readonly whatsapp: WhatsappCoreService) {
    super();
  }

  async process(job: Job) {
    const { tenantId, to, text } = job.data;

    await this.whatsapp.sendText({
      tenantId,
      phone: to,
      text,
    });
  }
}