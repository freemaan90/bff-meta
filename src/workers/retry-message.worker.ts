import { Processor, WorkerHost } from '@nestjs/bullmq';
import { Logger } from '@nestjs/common';
import { Job } from 'bullmq';
import { PrismaService } from '../database/prisma.service';
import { MessagesService } from '../modules/messages/messages.service';
import { RateLimiter } from '../integrations/meta/rate-limiter';
import { MetaApiError } from '../integrations/meta/errors';

export interface SendMessageJob {
  tenantId: string;
  campaignId?: string;
  phone: string;
  template?: string;
  language?: string;
  variables?: Record<string, string>;
  text?: string;
  mediaType?: 'image' | 'document' | 'audio' | 'video';
  mediaUrl?: string;
  caption?: string;
  filename?: string;
  messageDbId: string;
}

function isRecoverableError(error: unknown): boolean {
  if (error instanceof MetaApiError) {
    if (error.type === 'RATE_LIMIT') return true;
    if (error.code >= 500) return true;
    // 429 is recoverable (rate limit HTTP code)
    if (error.code === 429) return true;
    return false;
  }
  // Network/timeout errors (plain Error instances)
  if (error instanceof Error) return true;
  return false;
}

function isNonRecoverableError(error: unknown): boolean {
  if (error instanceof MetaApiError) {
    if (error.type === 'WINDOW_EXPIRED') return true;
    if (error.code >= 400 && error.code < 500 && error.code !== 429) return true;
    return false;
  }
  return false;
}

@Processor('send-message')
export class RetryMessageWorker extends WorkerHost {
  private readonly logger = new Logger(RetryMessageWorker.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly messagesService: MessagesService,
    private readonly rateLimiter: RateLimiter,
  ) {
    super();
  }

  async process(job: Job<SendMessageJob>): Promise<void> {
    const data = job.data;
    const { tenantId, messageDbId, campaignId } = data;

    // 1. Idempotency check: if already SENT, skip
    const message = await this.prisma.message.findUnique({ where: { id: messageDbId } });
    if (!message) {
      this.logger.warn(`Message ${messageDbId} not found in DB, skipping job`);
      return;
    }
    if (message.status === 'SENT') {
      this.logger.log(`Message ${messageDbId} already SENT, skipping (idempotent)`);
      return;
    }

    // 2. Check if tenant is paused
    const isPaused = await this.rateLimiter.isTenantPaused(tenantId);
    if (isPaused) {
      throw new Error(`Tenant ${tenantId} is paused due to rate limiting`);
    }

    // 3. Acquire rate limit token
    await this.rateLimiter.acquire(tenantId);

    // 4. Send message based on type
    try {
      if (data.text !== undefined) {
        await this.messagesService.sendText(tenantId, data.phone, data.text);
      } else if (data.template !== undefined) {
        await this.messagesService.sendTemplate(
          tenantId,
          data.phone,
          data.template,
          data.language ?? 'es',
          data.variables,
        );
      } else if (data.mediaType !== undefined) {
        await this.messagesService.sendMedia(
          tenantId,
          data.phone,
          data.mediaType,
          data.mediaUrl!,
          data.caption,
          data.filename,
        );
      } else {
        this.logger.error(`Job ${job.id} has no recognized message type`);
        await this.prisma.message.update({
          where: { id: messageDbId },
          data: { status: 'FAILED', error: 'Unknown message type in job' },
        });
        return;
      }

      // 5. On success: update status and increment campaign sentCount
      await this.prisma.message.update({
        where: { id: messageDbId },
        data: { status: 'SENT' },
      });

      if (campaignId) {
        await this.prisma.campaign.update({
          where: { id: campaignId },
          data: { sentCount: { increment: 1 } },
        });
      }

      this.logger.log(`Message ${messageDbId} sent successfully`);
    } catch (error) {
      if (isNonRecoverableError(error)) {
        // Mark FAILED immediately, do NOT rethrow (BullMQ won't retry)
        const errorMsg = error instanceof Error ? error.message : String(error);
        this.logger.warn(`Non-recoverable error for message ${messageDbId}: ${errorMsg}`);
        await this.prisma.message.update({
          where: { id: messageDbId },
          data: { status: 'FAILED', error: errorMsg },
        });

        if (campaignId) {
          await this.prisma.campaign.update({
            where: { id: campaignId },
            data: { failedCount: { increment: 1 } },
          });
        }
        return;
      }

      if (isRecoverableError(error)) {
        // If RATE_LIMIT, pause the tenant before rethrowing
        if (error instanceof MetaApiError && error.type === 'RATE_LIMIT') {
          await this.rateLimiter.pauseTenant(tenantId, 60000);
        }
        // Rethrow so BullMQ retries
        throw error;
      }

      // Unknown error type — treat as recoverable (rethrow)
      throw error;
    }
  }
}
