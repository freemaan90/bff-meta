import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../database/prisma.service';
import { CreateTenantDto } from './dto/create-tenant.dto';
import { UpdateTenantDto } from './dto/update-tenant.dto';
import { UpdateChatbotDto } from '../chatbot/dto/update-chatbot.dto';

@Injectable()
export class TenantsService {
  constructor(private readonly prisma: PrismaService) {}

  create(data: CreateTenantDto) {
    return this.prisma.tenant.create({ data });
  }

  findAll() {
    return this.prisma.tenant.findMany();
  }

  async findOne(id: string) {
    const tenant = await this.prisma.tenant.findUnique({ where: { id } });
    if (!tenant) throw new NotFoundException('Tenant not found');
    return tenant;
  }

  async update(id: string, data: UpdateTenantDto) {
    await this.findOne(id); // valida existencia
    return this.prisma.tenant.update({
      where: { id },
      data,
    });
  }

  async delete(id: string) {
    await this.prisma.incomingMessage.deleteMany({
      where: { tenantId: id },
    });
    await this.prisma.message.deleteMany({
      where: { tenantId: id },
    });
    await this.prisma.campaign.deleteMany({
      where: { tenantId: id },
    });

    await this.prisma.apiKey.deleteMany({
      where: { tenantId: id },
    });

    return this.prisma.tenant.delete({
      where: { id },
    });
  }

  async updateChatbot(id: string, dto: UpdateChatbotDto) {
  await this.findOne(id); // valida que exista

  return this.prisma.tenant.update({
    where: { id },
    data: {
      chatbotEnabled: dto.chatbotEnabled,
      chatbotMode: dto.chatbotMode,
      chatbotRules: dto.chatbotRules,
      chatbotPrompt: dto.chatbotPrompt,
    },
  });
}

}
