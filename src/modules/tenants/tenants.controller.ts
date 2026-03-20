import {
  Controller,
  Post,
  Get,
  Patch,
  Param,
  Body,
  Delete,
} from '@nestjs/common';
import { TenantsService } from './tenants.service';
import { CreateTenantDto } from './dto/create-tenant.dto';
import { UpdateTenantDto } from './dto/update-tenant.dto';
import { UpdateChatbotDto } from '../chatbot/dto/update-chatbot.dto';

@Controller('tenants')
export class TenantsController {
  constructor(private readonly tenantsService: TenantsService) {}

  @Post()
  create(@Body() dto: CreateTenantDto) {
    return this.tenantsService.create(dto);
  }

  @Get()
  findAll() {
    return this.tenantsService.findAll();
  }

  @Get(':id')
  findOne(@Param('id') id: string) {
    return this.tenantsService.findOne(id);
  }

  @Patch(':id')
  update(@Param('id') id: string, @Body() dto: UpdateTenantDto) {
    return this.tenantsService.update(id, dto);
  }

  @Delete(`:id`)
  delete(@Param('id') id: string) {
    return this.tenantsService.delete(id);
  }

  @Patch(':id/chatbot')
  updateChatbot(@Param('id') id: string, @Body() dto: UpdateChatbotDto) {
    return this.tenantsService.updateChatbot(id, dto);
  }
}
