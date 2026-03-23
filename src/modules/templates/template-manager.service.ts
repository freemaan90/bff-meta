import { Injectable, UnprocessableEntityException } from '@nestjs/common';
import { PrismaService } from '../../database/prisma.service';
import { MetaClient } from '../../integrations/meta/meta.client';
import { MetaApiError } from '../../integrations/meta/errors';
import { CreateTemplateDto, MetaTemplate, MetaTemplateResult } from '../../integrations/meta/types';

@Injectable()
export class TemplateManager {
  constructor(
    private readonly prisma: PrismaService,
    private readonly metaClient: MetaClient,
  ) {}

  async list(tenantId: string): Promise<MetaTemplate[]> {
    const tenant = await this.prisma.tenant.findUniqueOrThrow({ where: { id: tenantId } });
    try {
      return await this.metaClient.listTemplates(
        (tenant as any).wabaId ?? '',
        tenant.accessToken!,
      );
    } catch (error) {
      if (error instanceof MetaApiError) {
        throw new UnprocessableEntityException({
          code: error.code,
          message: error.message,
          type: error.type,
          fbtrace_id: error.fbtrace_id,
        });
      }
      throw error;
    }
  }

  async create(tenantId: string, dto: CreateTemplateDto): Promise<MetaTemplateResult> {
    const tenant = await this.prisma.tenant.findUniqueOrThrow({ where: { id: tenantId } });
    try {
      return await this.metaClient.createTemplate(
        (tenant as any).wabaId ?? '',
        tenant.accessToken!,
        dto,
      );
    } catch (error) {
      if (error instanceof MetaApiError) {
        throw new UnprocessableEntityException({
          code: error.code,
          message: error.message,
          type: error.type,
          fbtrace_id: error.fbtrace_id,
        });
      }
      throw error;
    }
  }

  async delete(tenantId: string, name: string): Promise<void> {
    const tenant = await this.prisma.tenant.findUniqueOrThrow({ where: { id: tenantId } });
    try {
      await this.metaClient.deleteTemplate(
        (tenant as any).wabaId ?? '',
        tenant.accessToken!,
        name,
      );
    } catch (error) {
      if (error instanceof MetaApiError) {
        throw new UnprocessableEntityException({
          code: error.code,
          message: error.message,
          type: error.type,
          fbtrace_id: error.fbtrace_id,
        });
      }
      throw error;
    }
  }
}
