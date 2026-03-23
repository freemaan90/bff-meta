import * as fc from 'fast-check';
import { Job } from 'bullmq';
import { RetryMessageWorker, SendMessageJob } from './retry-message.worker';
import { MetaApiError } from '../integrations/meta/errors';

// Mock PrismaService to avoid loading the generated Prisma client in tests
jest.mock('../database/prisma.service', () => ({
  PrismaService: jest.fn(),
}));

// Mock MessagesService
jest.mock('../modules/messages/messages.service', () => ({
  MessagesService: jest.fn(),
}));

// Mock RateLimiter
jest.mock('../integrations/meta/rate-limiter', () => ({
  RateLimiter: jest.fn(),
}));

// ─── Mock factories ──────────────────────────────────────────────────────────

function buildMocks() {
  const prisma = {
    message: {
      findUnique: jest.fn(),
      update: jest.fn(),
    },
    campaign: {
      update: jest.fn(),
    },
  };

  const messagesService = {
    sendText: jest.fn(),
    sendTemplate: jest.fn(),
    sendMedia: jest.fn(),
  };

  const rateLimiter = {
    acquire: jest.fn().mockResolvedValue(undefined),
    isTenantPaused: jest.fn().mockResolvedValue(false),
    pauseTenant: jest.fn().mockResolvedValue(undefined),
  };

  return { prisma, messagesService, rateLimiter };
}

function makeWorker(mocks: ReturnType<typeof buildMocks>) {
  return new RetryMessageWorker(
    mocks.prisma as any,
    mocks.messagesService as any,
    mocks.rateLimiter as any,
  );
}

function makeJob(data: Partial<SendMessageJob> = {}): Job<SendMessageJob> {
  return {
    id: 'job-1',
    data: {
      tenantId: 'tenant-1',
      phone: '+5491112345678',
      messageDbId: 'msg-1',
      text: 'Hello',
      ...data,
    },
    attemptsMade: 0,
  } as unknown as Job<SendMessageJob>;
}

function makeQueuedMessage(id = 'msg-1') {
  return { id, tenantId: 'tenant-1', phone: '+5491112345678', status: 'QUEUED' };
}

function makeSentMessage(id = 'msg-1') {
  return { id, tenantId: 'tenant-1', phone: '+5491112345678', status: 'SENT' };
}

function makeMetaApiError(code: number, type: string) {
  return new MetaApiError({ code, message: `Error ${code}`, type, fbtrace_id: 'trace-xyz' });
}

// ─── Unit tests ──────────────────────────────────────────────────────────────

describe('RetryMessageWorker', () => {
  let mocks: ReturnType<typeof buildMocks>;
  let worker: RetryMessageWorker;

  beforeEach(() => {
    mocks = buildMocks();
    worker = makeWorker(mocks);
  });

  describe('Idempotency', () => {
    it('skips sending if message is already SENT', async () => {
      mocks.prisma.message.findUnique.mockResolvedValue(makeSentMessage());

      await worker.process(makeJob());

      expect(mocks.messagesService.sendText).not.toHaveBeenCalled();
      expect(mocks.messagesService.sendTemplate).not.toHaveBeenCalled();
      expect(mocks.messagesService.sendMedia).not.toHaveBeenCalled();
    });

    it('skips if message not found in DB', async () => {
      mocks.prisma.message.findUnique.mockResolvedValue(null);

      await worker.process(makeJob());

      expect(mocks.messagesService.sendText).not.toHaveBeenCalled();
    });
  });

  describe('Tenant pause check', () => {
    it('throws recoverable error if tenant is paused', async () => {
      mocks.prisma.message.findUnique.mockResolvedValue(makeQueuedMessage());
      mocks.rateLimiter.isTenantPaused.mockResolvedValue(true);

      await expect(worker.process(makeJob())).rejects.toThrow();
      expect(mocks.messagesService.sendText).not.toHaveBeenCalled();
    });
  });

  describe('Message type routing', () => {
    it('calls sendText when job has text field', async () => {
      mocks.prisma.message.findUnique.mockResolvedValue(makeQueuedMessage());
      mocks.prisma.message.update.mockResolvedValue({});
      mocks.messagesService.sendText.mockResolvedValue({ messageId: 'wamid.1' });

      await worker.process(makeJob({ text: 'Hello world' }));

      expect(mocks.messagesService.sendText).toHaveBeenCalledWith('tenant-1', '+5491112345678', 'Hello world');
    });

    it('calls sendTemplate when job has template field', async () => {
      mocks.prisma.message.findUnique.mockResolvedValue(makeQueuedMessage());
      mocks.prisma.message.update.mockResolvedValue({});
      mocks.messagesService.sendTemplate.mockResolvedValue({ messageId: 'wamid.2' });

      await worker.process(makeJob({ text: undefined, template: 'my_tpl', language: 'es', variables: { name: 'Ana' } }));

      expect(mocks.messagesService.sendTemplate).toHaveBeenCalledWith(
        'tenant-1', '+5491112345678', 'my_tpl', 'es', { name: 'Ana' },
      );
    });

    it('calls sendMedia when job has mediaType field', async () => {
      mocks.prisma.message.findUnique.mockResolvedValue(makeQueuedMessage());
      mocks.prisma.message.update.mockResolvedValue({});
      mocks.messagesService.sendMedia.mockResolvedValue({ messageId: 'wamid.3' });

      await worker.process(makeJob({
        text: undefined,
        mediaType: 'image',
        mediaUrl: 'https://example.com/img.jpg',
        caption: 'A photo',
      }));

      expect(mocks.messagesService.sendMedia).toHaveBeenCalledWith(
        'tenant-1', '+5491112345678', 'image', 'https://example.com/img.jpg', 'A photo', undefined,
      );
    });
  });

  describe('Success path', () => {
    it('updates message to SENT on success', async () => {
      mocks.prisma.message.findUnique.mockResolvedValue(makeQueuedMessage());
      mocks.prisma.message.update.mockResolvedValue({});
      mocks.messagesService.sendText.mockResolvedValue({ messageId: 'wamid.1' });

      await worker.process(makeJob());

      expect(mocks.prisma.message.update).toHaveBeenCalledWith(
        expect.objectContaining({ data: expect.objectContaining({ status: 'SENT' }) }),
      );
    });

    it('increments campaign sentCount on success when campaignId present', async () => {
      mocks.prisma.message.findUnique.mockResolvedValue(makeQueuedMessage());
      mocks.prisma.message.update.mockResolvedValue({});
      mocks.prisma.campaign.update.mockResolvedValue({});
      mocks.messagesService.sendText.mockResolvedValue({ messageId: 'wamid.1' });

      await worker.process(makeJob({ campaignId: 'campaign-1' }));

      expect(mocks.prisma.campaign.update).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: 'campaign-1' },
          data: { sentCount: { increment: 1 } },
        }),
      );
    });

    it('does NOT update campaign if no campaignId', async () => {
      mocks.prisma.message.findUnique.mockResolvedValue(makeQueuedMessage());
      mocks.prisma.message.update.mockResolvedValue({});
      mocks.messagesService.sendText.mockResolvedValue({ messageId: 'wamid.1' });

      await worker.process(makeJob({ campaignId: undefined }));

      expect(mocks.prisma.campaign.update).not.toHaveBeenCalled();
    });
  });

  describe('Non-recoverable errors', () => {
    it('marks FAILED and does NOT rethrow for WINDOW_EXPIRED', async () => {
      mocks.prisma.message.findUnique.mockResolvedValue(makeQueuedMessage());
      mocks.prisma.message.update.mockResolvedValue({});
      mocks.messagesService.sendText.mockRejectedValue(makeMetaApiError(131047, 'WINDOW_EXPIRED'));

      await expect(worker.process(makeJob())).resolves.toBeUndefined();

      expect(mocks.prisma.message.update).toHaveBeenCalledWith(
        expect.objectContaining({ data: expect.objectContaining({ status: 'FAILED' }) }),
      );
    });

    it('marks FAILED and does NOT rethrow for HTTP 4xx (non-429)', async () => {
      mocks.prisma.message.findUnique.mockResolvedValue(makeQueuedMessage());
      mocks.prisma.message.update.mockResolvedValue({});
      mocks.messagesService.sendText.mockRejectedValue(makeMetaApiError(400, 'CLIENT_ERROR'));

      await expect(worker.process(makeJob())).resolves.toBeUndefined();

      expect(mocks.prisma.message.update).toHaveBeenCalledWith(
        expect.objectContaining({ data: expect.objectContaining({ status: 'FAILED' }) }),
      );
    });

    it('increments campaign failedCount on non-recoverable error', async () => {
      mocks.prisma.message.findUnique.mockResolvedValue(makeQueuedMessage());
      mocks.prisma.message.update.mockResolvedValue({});
      mocks.prisma.campaign.update.mockResolvedValue({});
      mocks.messagesService.sendText.mockRejectedValue(makeMetaApiError(400, 'CLIENT_ERROR'));

      await worker.process(makeJob({ campaignId: 'campaign-1' }));

      expect(mocks.prisma.campaign.update).toHaveBeenCalledWith(
        expect.objectContaining({ data: { failedCount: { increment: 1 } } }),
      );
    });
  });

  describe('Recoverable errors', () => {
    it('rethrows for HTTP 5xx so BullMQ retries', async () => {
      mocks.prisma.message.findUnique.mockResolvedValue(makeQueuedMessage());
      mocks.messagesService.sendText.mockRejectedValue(makeMetaApiError(500, 'SERVER_ERROR'));

      await expect(worker.process(makeJob())).rejects.toBeInstanceOf(MetaApiError);
      expect(mocks.prisma.message.update).not.toHaveBeenCalledWith(
        expect.objectContaining({ data: expect.objectContaining({ status: 'FAILED' }) }),
      );
    });

    it('rethrows for network errors (plain Error)', async () => {
      mocks.prisma.message.findUnique.mockResolvedValue(makeQueuedMessage());
      mocks.messagesService.sendText.mockRejectedValue(new Error('ECONNRESET'));

      await expect(worker.process(makeJob())).rejects.toBeInstanceOf(Error);
    });

    it('calls pauseTenant and rethrows for RATE_LIMIT error', async () => {
      mocks.prisma.message.findUnique.mockResolvedValue(makeQueuedMessage());
      mocks.messagesService.sendText.mockRejectedValue(makeMetaApiError(130429, 'RATE_LIMIT'));

      await expect(worker.process(makeJob())).rejects.toBeInstanceOf(MetaApiError);
      expect(mocks.rateLimiter.pauseTenant).toHaveBeenCalledWith('tenant-1', 60000);
    });
  });

  // ─── Property 7: Retry classification invariant ───────────────────────────
  // Feature: meta-api-integration, Property 7: For any failed message job, if the error is
  // recoverable (network timeout, HTTP 5xx, or type === 'RATE_LIMIT'), the job SHALL be re-enqueued;
  // if the error is non-recoverable (HTTP 4xx excluding 429, or type === 'WINDOW_EXPIRED'),
  // the message SHALL be marked FAILED immediately with no re-enqueue.
  describe('Property 7: Retry classification invariant', () => {
    it('recoverable errors always rethrow (BullMQ re-enqueues)', async () => {
      await fc.assert(
        fc.asyncProperty(
          fc.oneof(
            // HTTP 5xx codes
            fc.integer({ min: 500, max: 599 }).map((code) => makeMetaApiError(code, 'SERVER_ERROR')),
            // RATE_LIMIT type
            fc.constant(makeMetaApiError(130429, 'RATE_LIMIT')),
            // Network errors
            fc.string({ minLength: 1, maxLength: 50 }).map((msg) => new Error(msg)),
          ),
          async (error) => {
            const localMocks = buildMocks();
            const w = makeWorker(localMocks);
            localMocks.prisma.message.findUnique.mockResolvedValue(makeQueuedMessage());
            localMocks.prisma.message.update.mockResolvedValue({});
            localMocks.messagesService.sendText.mockRejectedValue(error);

            let threw = false;
            try {
              await w.process(makeJob());
            } catch {
              threw = true;
            }

            expect(threw).toBe(true);
            // Should NOT have been marked FAILED
            const failedCall = localMocks.prisma.message.update.mock.calls.find(
              (call) => call[0]?.data?.status === 'FAILED',
            );
            expect(failedCall).toBeUndefined();
          },
        ),
        { numRuns: 100 },
      );
    });

    it('non-recoverable errors never rethrow and always mark FAILED', async () => {
      await fc.assert(
        fc.asyncProperty(
          fc.oneof(
            // HTTP 4xx (not 429)
            fc.integer({ min: 400, max: 428 }).map((code) => makeMetaApiError(code, 'CLIENT_ERROR')),
            fc.integer({ min: 430, max: 499 }).map((code) => makeMetaApiError(code, 'CLIENT_ERROR')),
            // WINDOW_EXPIRED
            fc.constant(makeMetaApiError(131047, 'WINDOW_EXPIRED')),
          ),
          async (error) => {
            const localMocks = buildMocks();
            const w = makeWorker(localMocks);
            localMocks.prisma.message.findUnique.mockResolvedValue(makeQueuedMessage());
            localMocks.prisma.message.update.mockResolvedValue({});
            localMocks.messagesService.sendText.mockRejectedValue(error);

            let threw = false;
            try {
              await w.process(makeJob());
            } catch {
              threw = true;
            }

            expect(threw).toBe(false);
            const failedCall = localMocks.prisma.message.update.mock.calls.find(
              (call) => call[0]?.data?.status === 'FAILED',
            );
            expect(failedCall).toBeDefined();
          },
        ),
        { numRuns: 100 },
      );
    });
  });

  // ─── Property 8: Max retry count invariant ────────────────────────────────
  // Feature: meta-api-integration, Property 8: For any message job that fails on every attempt,
  // after exactly 3 failed attempts the message record in the database SHALL have status FAILED
  // and no further retry SHALL be enqueued.
  // Note: BullMQ handles the 3-attempt limit via queue config (attempts: 3).
  // The worker's responsibility is: on the final attempt with a non-recoverable error,
  // mark FAILED and don't rethrow. For recoverable errors, BullMQ stops after 3 attempts
  // and the job moves to failed state. We test that after a non-recoverable error the
  // message is always marked FAILED regardless of attemptsMade.
  describe('Property 8: Max retry count invariant', () => {
    it('always marks FAILED on non-recoverable error regardless of attempt number', async () => {
      await fc.assert(
        fc.asyncProperty(
          fc.integer({ min: 0, max: 10 }),
          fc.oneof(
            fc.integer({ min: 400, max: 428 }).map((code) => makeMetaApiError(code, 'CLIENT_ERROR')),
            fc.integer({ min: 430, max: 499 }).map((code) => makeMetaApiError(code, 'CLIENT_ERROR')),
            fc.constant(makeMetaApiError(131047, 'WINDOW_EXPIRED')),
          ),
          async (attemptsMade, error) => {
            const localMocks = buildMocks();
            const w = makeWorker(localMocks);
            localMocks.prisma.message.findUnique.mockResolvedValue(makeQueuedMessage());
            localMocks.prisma.message.update.mockResolvedValue({});
            localMocks.messagesService.sendText.mockRejectedValue(error);

            const job = { ...makeJob(), attemptsMade } as Job<SendMessageJob>;

            await w.process(job);

            const failedCall = localMocks.prisma.message.update.mock.calls.find(
              (call) => call[0]?.data?.status === 'FAILED',
            );
            expect(failedCall).toBeDefined();
          },
        ),
        { numRuns: 100 },
      );
    });
  });

  // ─── Property 9: Retry job data preservation ─────────────────────────────
  // Feature: meta-api-integration, Property 9: For any message job that is re-enqueued after
  // a failure, the re-enqueued job SHALL contain the same tenantId, campaignId, phone, and
  // variables as the original job.
  // Note: BullMQ automatically re-enqueues the same job data on retry. The worker does NOT
  // create a new job — it just rethrows the error. We verify that the job data passed to
  // process() is preserved (not mutated) when a recoverable error occurs.
  describe('Property 9: Retry job data preservation', () => {
    it('does not mutate job data on recoverable error', async () => {
      await fc.assert(
        fc.asyncProperty(
          fc.record({
            tenantId: fc.uuid(),
            campaignId: fc.option(fc.uuid(), { nil: undefined }),
            phone: fc.stringMatching(/^\+[1-9]\d{6,14}$/),
            variables: fc.option(
              fc.dictionary(fc.string({ minLength: 1, maxLength: 10 }), fc.string({ minLength: 1, maxLength: 20 })),
              { nil: undefined },
            ),
          }),
          async ({ tenantId, campaignId, phone, variables }) => {
            const localMocks = buildMocks();
            const w = makeWorker(localMocks);
            localMocks.prisma.message.findUnique.mockResolvedValue({ ...makeQueuedMessage(), tenantId });
            localMocks.messagesService.sendText.mockRejectedValue(makeMetaApiError(500, 'SERVER_ERROR'));

            const jobData: SendMessageJob = {
              tenantId,
              campaignId: campaignId ?? undefined,
              phone,
              text: 'test',
              messageDbId: 'msg-1',
              variables: variables ?? undefined,
            };
            const job = { id: 'job-1', data: jobData, attemptsMade: 0 } as unknown as Job<SendMessageJob>;

            const originalData = { ...jobData };

            try {
              await w.process(job);
            } catch {
              // expected rethrow
            }

            // Job data must not be mutated
            expect(job.data.tenantId).toBe(originalData.tenantId);
            expect(job.data.campaignId).toBe(originalData.campaignId);
            expect(job.data.phone).toBe(originalData.phone);
            expect(job.data.variables).toEqual(originalData.variables);
          },
        ),
        { numRuns: 100 },
      );
    });
  });

  // ─── Property 10: Retry idempotence ──────────────────────────────────────
  // Feature: meta-api-integration, Property 10: For any message that has already been
  // successfully sent (status SENT in DB), processing the same job again SHALL NOT create
  // a duplicate message in WhatsApp or insert a new Message record in the database.
  describe('Property 10: Retry idempotence', () => {
    it('never calls send methods when message is already SENT', async () => {
      await fc.assert(
        fc.asyncProperty(
          fc.record({
            tenantId: fc.uuid(),
            phone: fc.stringMatching(/^\+[1-9]\d{6,14}$/),
            messageDbId: fc.uuid(),
          }),
          fc.oneof(
            fc.record({ text: fc.string({ minLength: 1 }) }),
            fc.record({ template: fc.string({ minLength: 1 }), language: fc.constant('es') }),
            fc.record({
              mediaType: fc.constantFrom('image', 'document', 'audio', 'video') as fc.Arbitrary<'image' | 'document' | 'audio' | 'video'>,
              mediaUrl: fc.constant('https://example.com/file'),
            }),
          ),
          async ({ tenantId, phone, messageDbId }, msgTypeData) => {
            const localMocks = buildMocks();
            const w = makeWorker(localMocks);

            // Message is already SENT
            localMocks.prisma.message.findUnique.mockResolvedValue({
              id: messageDbId,
              tenantId,
              phone,
              status: 'SENT',
            });

            const jobData: SendMessageJob = {
              tenantId,
              phone,
              messageDbId,
              ...msgTypeData,
            };
            const job = { id: 'job-1', data: jobData, attemptsMade: 0 } as unknown as Job<SendMessageJob>;

            await w.process(job);

            // No send methods should be called
            expect(localMocks.messagesService.sendText).not.toHaveBeenCalled();
            expect(localMocks.messagesService.sendTemplate).not.toHaveBeenCalled();
            expect(localMocks.messagesService.sendMedia).not.toHaveBeenCalled();
            // No DB writes
            expect(localMocks.prisma.message.update).not.toHaveBeenCalled();
          },
        ),
        { numRuns: 100 },
      );
    });
  });
});
