import { CanActivate, ExecutionContext, Injectable, ForbiddenException } from '@nestjs/common';
import { PrismaService } from 'src/database/prisma.service';

@Injectable()
export class SubscriptionGuard implements CanActivate {
  constructor(private readonly prisma: PrismaService) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const req = context.switchToHttp().getRequest();
    const tenantId: string = req.user?.tenantId;
    if (!tenantId) return false;

    const sub = await this.prisma.subscription.findUnique({ where: { tenantId } });
    if (!sub) throw new ForbiddenException('No active subscription');

    if (sub.status === 'CANCELLED') {
      throw new ForbiddenException('Subscription cancelled');
    }

    if (sub.plan === 'FREE_TRIAL' && new Date() > sub.trialEndsAt) {
      // Marcar como expirada
      await this.prisma.subscription.update({
        where: { tenantId },
        data: { status: 'EXPIRED' },
      });
      throw new ForbiddenException('Free trial expired. Please upgrade to a monthly plan.');
    }

    if (sub.plan === 'MONTHLY' && sub.currentPeriodEnd && new Date() > sub.currentPeriodEnd) {
      await this.prisma.subscription.update({
        where: { tenantId },
        data: { status: 'EXPIRED' },
      });
      throw new ForbiddenException('Subscription expired. Please renew.');
    }

    return true;
  }
}
