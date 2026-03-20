import { Controller } from '@nestjs/common';
import { WhatsappCoreService } from './whatsapp-core.service';

@Controller('whatsapp-core')
export class WhatsappCoreController {
  constructor(private readonly whatsappCoreService: WhatsappCoreService) {}
}
