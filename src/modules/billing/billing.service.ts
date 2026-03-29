import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from 'src/database/prisma.service';

@Injectable()
export class BillingService {
  constructor(private readonly prisma: PrismaService) {}

  /**
   * Registra el costo de un mensaje enviado.
   * Se llama desde el worker cuando un mensaje pasa a SENT/DELIVERED.
   */
  async recordMessage(params: {
    tenantId: string;
    messageId: string;
    countryCode: string;
    category: string; // "marketing" | "utility" | "authentication"
  }) {
    const { tenantId, messageId, countryCode, category } = params;

    const price = await this.prisma.metaMessagePrice.findUnique({
      where: { countryCode_category: { countryCode, category } },
    });

    const metaCost = price?.priceUsd ?? 0;
    const period = new Date().toISOString().slice(0, 7); // "2026-03"

    return this.prisma.billingRecord.upsert({
      where: { messageId },
      create: { tenantId, messageId, metaCost, period },
      update: { metaCost },
    });
  }

  /** Resumen mensual para un tenant */
  async getMonthlySummary(tenantId: string, period?: string) {
    const targetPeriod = period ?? new Date().toISOString().slice(0, 7);

    const records = await this.prisma.billingRecord.findMany({
      where: { tenantId, period: targetPeriod },
    });

    const subscription = await this.prisma.subscription.findUnique({
      where: { tenantId },
    });

    const totalMetaCost = records.reduce((sum, r) => sum + r.metaCost, 0);
    const monthlyFee = subscription?.monthlyFee ?? 0;
    const messageCount = records.length;

    return {
      period: targetPeriod,
      messageCount,
      totalMetaCost: +totalMetaCost.toFixed(4),
      monthlyFee,
      total: +(totalMetaCost + monthlyFee).toFixed(4),
    };
  }

  /** Historial de períodos */
  async getBillingHistory(tenantId: string) {
    const records = await this.prisma.billingRecord.groupBy({
      by: ['period'],
      where: { tenantId },
      _sum: { metaCost: true },
      _count: { id: true },
      orderBy: { period: 'desc' },
    });

    const subscription = await this.prisma.subscription.findUnique({
      where: { tenantId },
    });

    return records.map((r) => ({
      period: r.period,
      messageCount: r._count.id,
      totalMetaCost: +(r._sum.metaCost ?? 0).toFixed(4),
      monthlyFee: subscription?.monthlyFee ?? 0,
      total: +((r._sum.metaCost ?? 0) + (subscription?.monthlyFee ?? 0)).toFixed(4),
    }));
  }

  /** ADMIN: actualizar precio de Meta por país/categoría */
  async upsertMetaPrice(countryCode: string, category: string, priceUsd: number) {
    return this.prisma.metaMessagePrice.upsert({
      where: { countryCode_category: { countryCode, category } },
      create: { countryCode, category, priceUsd },
      update: { priceUsd },
    });
  }

  async listMetaPrices() {
    return this.prisma.metaMessagePrice.findMany({ orderBy: [{ countryCode: 'asc' }, { category: 'asc' }] });
  }

  /** Estado de suscripción del tenant */
  async getSubscription(tenantId: string) {
    const sub = await this.prisma.subscription.findUnique({ where: { tenantId } });
    if (!sub) throw new NotFoundException('Subscription not found');
    return sub;
  }

  /** Activar plan mensual (después del trial) */
  async activateMonthly(tenantId: string) {
    const now = new Date();
    const periodEnd = new Date(now);
    periodEnd.setMonth(periodEnd.getMonth() + 1);

    return this.prisma.subscription.update({
      where: { tenantId },
      data: {
        plan: 'MONTHLY',
        status: 'ACTIVE',
        currentPeriodStart: now,
        currentPeriodEnd: periodEnd,
      },
    });
  }
}
