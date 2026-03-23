import { Body, Controller, Delete, Get, Param, Post, Req, UseGuards } from '@nestjs/common';
import { ApiKeyGuard } from '../auth/guards/api-key.guard';
import { CreateTemplateDto } from '../../integrations/meta/types';
import { TemplateManager } from './template-manager.service';

@Controller('templates')
@UseGuards(ApiKeyGuard)
export class TemplatesController {
  constructor(private readonly templateManager: TemplateManager) {}

  @Get()
  list(@Req() req: { tenantId: string }) {
    return this.templateManager.list(req.tenantId);
  }

  @Post()
  create(@Req() req: { tenantId: string }, @Body() dto: CreateTemplateDto) {
    return this.templateManager.create(req.tenantId, dto);
  }

  @Delete(':name')
  delete(@Req() req: { tenantId: string }, @Param('name') name: string) {
    return this.templateManager.delete(req.tenantId, name);
  }
}
