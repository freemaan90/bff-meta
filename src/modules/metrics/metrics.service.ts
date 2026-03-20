import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../database/prisma.service';

@Injectable()
export class MetricsService {
  constructor(private readonly prisma: PrismaService) {}

  async getCampaignMetrics(campaignId: string) {
    const rows = await this.prisma.message.groupBy({
      by: ['status'],
      where: { campaignId },
      _count: { status: true },
    });

    const total = rows.reduce((acc, r) => acc + r._count.status, 0);

    const get = (status: string) =>
      rows.find((r) => r.status === status)?._count.status ?? 0;

    return {
      campaignId,
      total,
      sent: get('SENT'),
      delivered: get('DELIVERED'),
      read: get('READ'),
      failed: get('FAILED'),
      deliveryRate: total ? get('DELIVERED') / total : 0,
      readRate: total ? get('READ') / total : 0,
    };
  }
}
