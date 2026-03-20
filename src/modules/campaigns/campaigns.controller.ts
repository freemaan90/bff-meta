import { Controller, Post, Body, UseGuards, Req } from '@nestjs/common';
import { CampaignsService } from './campaigns.service';
import { CreateCampaignDto } from './dto/create-campaign.dto';
import { ApiKeyGuard } from '../auth/guards/api-key.guard';

@Controller('campaigns')
@UseGuards(ApiKeyGuard)
export class CampaignsController {
  constructor(private readonly campaignsService: CampaignsService) {}

  @Post()
  create(@Req() req, @Body() dto: CreateCampaignDto) {
    return this.campaignsService.createCampaign(req.tenantId, dto);
  }
}
