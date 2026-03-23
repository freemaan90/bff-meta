import * as fc from 'fast-check';
import { MetaApiError, MessageSendException } from '../../integrations/meta/errors';
import { MessagesService } from './messages.service';

// Mock PrismaService to avoid loading the generated Prisma client in tests
jest.mock('../../database/prisma.service', () => ({
  PrismaService: jest.fn(),
}));

// Mock MetaClient to avoid loading ConfigService / Redis in tests
jest.mock('../../integrations/meta/meta.client', () => ({
  MetaClient: jest.fn(),
}));

// Mock MediaService
jest.mock('./media.service', () => ({
  MediaService: jest.fn(),
}));

// ─── Helpers ────────────────────────────────────────────────────────────────

function makeTenant(overrides: Partial<{ accessToken: string; phoneNumberId: string }> = {}) {
  return {
    id: 'tenant-1',
    name: 'Test Tenant',
    accessToken: overrides.accessToken ?? 'token-abc',
    phoneNumberId: overrides.phoneNumberId ?? 'phone-id-123',
    chatbotEnabled: false,
    chatbotMode: 'rules',
    chatbotRules: null,
    chatbotPrompt: null,
    createdAt: new Date(),
    updatedAt: new Date(),
    wabaId: null,
  };
}

function makeMessage(id = 'msg-1') {
  return { id, tenantId: 'tenant-1', phone: '+5491112345678', status: 'QUEUED', messageId: null, error: null };
}

function makeMetaApiError(code = 100, fbtrace_id = 'trace-xyz') {
  return new MetaApiError({ code, message: 'Meta error', type: 'OAuthException', fbtrace_id });
}

// ─── Mock factories ──────────────────────────────────────────────────────────

function buildMocks() {
  const prisma = {
    tenant: { findUniqueOrThrow: jest.fn() },
    message: { create: jest.fn(), update: jest.fn() },
  };

  const metaClient = {
    sendText: jest.fn(),
    sendTemplate: jest.fn(),
    sendMedia: jest.fn(),
  };

  const mediaService = {
    send: jest.fn(),
  };

  return { prisma, metaClient, mediaService };
}

// ─── Unit tests ──────────────────────────────────────────────────────────────

describe('MessagesService', () => {
  let service: MessagesService;
  let mocks: ReturnType<typeof buildMocks>;

  beforeEach(async () => {
    mocks = buildMocks();
    service = new MessagesService(mocks.prisma as any, mocks.metaClient as any, mocks.mediaService as any);
  });

  describe('sendText', () => {
    it('creates QUEUED message, calls MetaClient, updates to SENT', async () => {
      mocks.prisma.tenant.findUniqueOrThrow.mockResolvedValue(makeTenant());
      mocks.prisma.message.create.mockResolvedValue(makeMessage());
      mocks.prisma.message.update.mockResolvedValue({});
      mocks.metaClient.sendText.mockResolvedValue({ messageId: 'wamid.123' });

      const result = await service.sendText('tenant-1', '+5491112345678', 'Hello');

      expect(result).toEqual({ messageId: 'wamid.123' });
      expect(mocks.prisma.message.create).toHaveBeenCalledWith(
        expect.objectContaining({ data: expect.objectContaining({ status: 'QUEUED' }) }),
      );
      expect(mocks.prisma.message.update).toHaveBeenCalledWith(
        expect.objectContaining({ data: expect.objectContaining({ status: 'SENT', messageId: 'wamid.123' }) }),
      );
    });

    it('marks FAILED and throws MessageSendException on MetaApiError', async () => {
      mocks.prisma.tenant.findUniqueOrThrow.mockResolvedValue(makeTenant());
      mocks.prisma.message.create.mockResolvedValue(makeMessage());
      mocks.prisma.message.update.mockResolvedValue({});
      mocks.metaClient.sendText.mockRejectedValue(makeMetaApiError(131047, 'trace-abc'));

      await expect(service.sendText('tenant-1', '+5491112345678', 'Hello')).rejects.toBeInstanceOf(
        MessageSendException,
      );
      expect(mocks.prisma.message.update).toHaveBeenCalledWith(
        expect.objectContaining({ data: expect.objectContaining({ status: 'FAILED' }) }),
      );
    });

    it('throws ValidationException for invalid phone', async () => {
      await expect(service.sendText('tenant-1', 'not-a-phone', 'Hello')).rejects.toThrow();
    });
  });

  describe('sendTemplate', () => {
    it('creates QUEUED message, calls MetaClient, updates to SENT', async () => {
      mocks.prisma.tenant.findUniqueOrThrow.mockResolvedValue(makeTenant());
      mocks.prisma.message.create.mockResolvedValue(makeMessage());
      mocks.prisma.message.update.mockResolvedValue({});
      mocks.metaClient.sendTemplate.mockResolvedValue({ messageId: 'wamid.456' });

      const result = await service.sendTemplate('tenant-1', '+5491112345678', 'my_template', 'es', { name: 'Juan' });

      expect(result).toEqual({ messageId: 'wamid.456' });
      expect(mocks.prisma.message.update).toHaveBeenCalledWith(
        expect.objectContaining({ data: expect.objectContaining({ status: 'SENT' }) }),
      );
    });

    it('marks FAILED on error', async () => {
      mocks.prisma.tenant.findUniqueOrThrow.mockResolvedValue(makeTenant());
      mocks.prisma.message.create.mockResolvedValue(makeMessage());
      mocks.prisma.message.update.mockResolvedValue({});
      mocks.metaClient.sendTemplate.mockRejectedValue(makeMetaApiError());

      await expect(
        service.sendTemplate('tenant-1', '+5491112345678', 'tpl', 'es'),
      ).rejects.toBeInstanceOf(MessageSendException);
    });
  });

  describe('sendMedia', () => {
    it('creates QUEUED message, calls MediaService, updates to SENT', async () => {
      mocks.prisma.tenant.findUniqueOrThrow.mockResolvedValue(makeTenant());
      mocks.prisma.message.create.mockResolvedValue(makeMessage());
      mocks.prisma.message.update.mockResolvedValue({});
      mocks.mediaService.send.mockResolvedValue({ messageId: 'wamid.789' });

      const result = await service.sendMedia('tenant-1', '+5491112345678', 'image', 'https://example.com/img.jpg');

      expect(result).toEqual({ messageId: 'wamid.789' });
      expect(mocks.prisma.message.update).toHaveBeenCalledWith(
        expect.objectContaining({ data: expect.objectContaining({ status: 'SENT' }) }),
      );
    });

    it('marks FAILED on error', async () => {
      mocks.prisma.tenant.findUniqueOrThrow.mockResolvedValue(makeTenant());
      mocks.prisma.message.create.mockResolvedValue(makeMessage());
      mocks.prisma.message.update.mockResolvedValue({});
      mocks.mediaService.send.mockRejectedValue(makeMetaApiError());

      await expect(
        service.sendMedia('tenant-1', '+5491112345678', 'image', 'https://example.com/img.jpg'),
      ).rejects.toBeInstanceOf(MessageSendException);
    });
  });

  // ─── Property 6: Error propagation to MessageSendException ────────────────
  // Feature: meta-api-integration, Property 6: For any MetaApiError thrown by MetaClient,
  // MessagesService must catch it and rethrow as MessageSendException including fbtrace_id and code.
  describe('Property 6: MetaApiError → MessageSendException propagation', () => {
    it('should wrap any MetaApiError in MessageSendException preserving fbtrace_id and code', async () => {
      await fc.assert(
        fc.asyncProperty(
          fc.integer({ min: 100, max: 200000 }),
          fc.string({ minLength: 1, maxLength: 50 }),
          fc.string({ minLength: 1, maxLength: 100 }),
          async (code, fbtrace_id, message) => {
            const localMocks = buildMocks();
            const svc = new MessagesService(
              localMocks.prisma as any,
              localMocks.metaClient as any,
              localMocks.mediaService as any,
            );

            localMocks.prisma.tenant.findUniqueOrThrow.mockResolvedValue(makeTenant());
            localMocks.prisma.message.create.mockResolvedValue(makeMessage());
            localMocks.prisma.message.update.mockResolvedValue({});

            const metaError = new MetaApiError({ code, message, type: 'SomeType', fbtrace_id });
            localMocks.metaClient.sendText.mockRejectedValue(metaError);

            let caught: unknown;
            try {
              await svc.sendText('tenant-1', '+5491112345678', 'test');
            } catch (e) {
              caught = e;
            }

            expect(caught).toBeInstanceOf(MessageSendException);
            const exc = caught as MessageSendException;
            expect(exc.cause).toBe(metaError);
            expect(exc.cause?.fbtrace_id).toBe(fbtrace_id);
            expect(exc.cause?.code).toBe(code);
          },
        ),
        { numRuns: 100 },
      );
    });
  });

  // ─── Property 18: Message send and persist round-trip ─────────────────────
  // Feature: meta-api-integration, Property 18: For any successful message send (text, template, media),
  // the Message record in DB must have status=SENT and the messageId returned by Graph API.
  describe('Property 18: Successful send persists SENT status and messageId', () => {
    it('should persist SENT status and correct messageId for text messages', async () => {
      await fc.assert(
        fc.asyncProperty(
          fc.string({ minLength: 1, maxLength: 50 }).map((s) => `wamid.${s}`),
          async (returnedMessageId) => {
            const localMocks = buildMocks();
            const svc = new MessagesService(
              localMocks.prisma as any,
              localMocks.metaClient as any,
              localMocks.mediaService as any,
            );

            localMocks.prisma.tenant.findUniqueOrThrow.mockResolvedValue(makeTenant());
            localMocks.prisma.message.create.mockResolvedValue(makeMessage());
            localMocks.prisma.message.update.mockResolvedValue({});
            localMocks.metaClient.sendText.mockResolvedValue({ messageId: returnedMessageId });

            const result = await svc.sendText('tenant-1', '+5491112345678', 'hello');

            expect(result.messageId).toBe(returnedMessageId);
            expect(localMocks.prisma.message.update).toHaveBeenCalledWith(
              expect.objectContaining({
                data: expect.objectContaining({ status: 'SENT', messageId: returnedMessageId }),
              }),
            );
          },
        ),
        { numRuns: 100 },
      );
    });

    it('should persist SENT status and correct messageId for template messages', async () => {
      await fc.assert(
        fc.asyncProperty(
          fc.string({ minLength: 1, maxLength: 50 }).map((s) => `wamid.${s}`),
          async (returnedMessageId) => {
            const localMocks = buildMocks();
            const svc = new MessagesService(
              localMocks.prisma as any,
              localMocks.metaClient as any,
              localMocks.mediaService as any,
            );

            localMocks.prisma.tenant.findUniqueOrThrow.mockResolvedValue(makeTenant());
            localMocks.prisma.message.create.mockResolvedValue(makeMessage());
            localMocks.prisma.message.update.mockResolvedValue({});
            localMocks.metaClient.sendTemplate.mockResolvedValue({ messageId: returnedMessageId });

            const result = await svc.sendTemplate('tenant-1', '+5491112345678', 'tpl', 'es');

            expect(result.messageId).toBe(returnedMessageId);
            expect(localMocks.prisma.message.update).toHaveBeenCalledWith(
              expect.objectContaining({
                data: expect.objectContaining({ status: 'SENT', messageId: returnedMessageId }),
              }),
            );
          },
        ),
        { numRuns: 100 },
      );
    });

    it('should persist SENT status and correct messageId for media messages', async () => {
      await fc.assert(
        fc.asyncProperty(
          fc.string({ minLength: 1, maxLength: 50 }).map((s) => `wamid.${s}`),
          fc.constantFrom('image', 'document', 'audio', 'video') as fc.Arbitrary<'image' | 'document' | 'audio' | 'video'>,
          async (returnedMessageId, mediaType) => {
            const localMocks = buildMocks();
            const svc = new MessagesService(
              localMocks.prisma as any,
              localMocks.metaClient as any,
              localMocks.mediaService as any,
            );

            localMocks.prisma.tenant.findUniqueOrThrow.mockResolvedValue(makeTenant());
            localMocks.prisma.message.create.mockResolvedValue(makeMessage());
            localMocks.prisma.message.update.mockResolvedValue({});
            localMocks.mediaService.send.mockResolvedValue({ messageId: returnedMessageId });

            const result = await svc.sendMedia('tenant-1', '+5491112345678', mediaType, 'https://example.com/file');

            expect(result.messageId).toBe(returnedMessageId);
            expect(localMocks.prisma.message.update).toHaveBeenCalledWith(
              expect.objectContaining({
                data: expect.objectContaining({ status: 'SENT', messageId: returnedMessageId }),
              }),
            );
          },
        ),
        { numRuns: 100 },
      );
    });
  });

  // ─── Property 19: Message failure persistence ──────────────────────────────
  // Feature: meta-api-integration, Property 19: For any failed message send,
  // the Message record in DB must have status=FAILED and error field populated with non-empty description.
  describe('Property 19: Failed send persists FAILED status with non-empty error', () => {
    it('should persist FAILED status with non-empty error for any MetaApiError on sendText', async () => {
      await fc.assert(
        fc.asyncProperty(
          fc.integer({ min: 100, max: 200000 }),
          fc.string({ minLength: 1, maxLength: 200 }),
          async (code, errorMessage) => {
            const localMocks = buildMocks();
            const svc = new MessagesService(
              localMocks.prisma as any,
              localMocks.metaClient as any,
              localMocks.mediaService as any,
            );

            localMocks.prisma.tenant.findUniqueOrThrow.mockResolvedValue(makeTenant());
            localMocks.prisma.message.create.mockResolvedValue(makeMessage());
            localMocks.prisma.message.update.mockResolvedValue({});

            const metaError = new MetaApiError({ code, message: errorMessage, type: 'SomeType', fbtrace_id: 'trace' });
            localMocks.metaClient.sendText.mockRejectedValue(metaError);

            try {
              await svc.sendText('tenant-1', '+5491112345678', 'test');
            } catch {
              // expected
            }

            const updateCall = localMocks.prisma.message.update.mock.calls[0][0];
            expect(updateCall.data.status).toBe('FAILED');
            expect(typeof updateCall.data.error).toBe('string');
            expect(updateCall.data.error.length).toBeGreaterThan(0);
          },
        ),
        { numRuns: 100 },
      );
    });

    it('should persist FAILED status with non-empty error for any MetaApiError on sendTemplate', async () => {
      await fc.assert(
        fc.asyncProperty(
          fc.integer({ min: 100, max: 200000 }),
          fc.string({ minLength: 1, maxLength: 200 }),
          async (code, errorMessage) => {
            const localMocks = buildMocks();
            const svc = new MessagesService(
              localMocks.prisma as any,
              localMocks.metaClient as any,
              localMocks.mediaService as any,
            );

            localMocks.prisma.tenant.findUniqueOrThrow.mockResolvedValue(makeTenant());
            localMocks.prisma.message.create.mockResolvedValue(makeMessage());
            localMocks.prisma.message.update.mockResolvedValue({});

            const metaError = new MetaApiError({ code, message: errorMessage, type: 'SomeType', fbtrace_id: 'trace' });
            localMocks.metaClient.sendTemplate.mockRejectedValue(metaError);

            try {
              await svc.sendTemplate('tenant-1', '+5491112345678', 'tpl', 'es');
            } catch {
              // expected
            }

            const updateCall = localMocks.prisma.message.update.mock.calls[0][0];
            expect(updateCall.data.status).toBe('FAILED');
            expect(typeof updateCall.data.error).toBe('string');
            expect(updateCall.data.error.length).toBeGreaterThan(0);
          },
        ),
        { numRuns: 100 },
      );
    });

    it('should persist FAILED status with non-empty error for any MetaApiError on sendMedia', async () => {
      await fc.assert(
        fc.asyncProperty(
          fc.integer({ min: 100, max: 200000 }),
          fc.string({ minLength: 1, maxLength: 200 }),
          async (code, errorMessage) => {
            const localMocks = buildMocks();
            const svc = new MessagesService(
              localMocks.prisma as any,
              localMocks.metaClient as any,
              localMocks.mediaService as any,
            );

            localMocks.prisma.tenant.findUniqueOrThrow.mockResolvedValue(makeTenant());
            localMocks.prisma.message.create.mockResolvedValue(makeMessage());
            localMocks.prisma.message.update.mockResolvedValue({});

            const metaError = new MetaApiError({ code, message: errorMessage, type: 'SomeType', fbtrace_id: 'trace' });
            localMocks.mediaService.send.mockRejectedValue(metaError);

            try {
              await svc.sendMedia('tenant-1', '+5491112345678', 'image', 'https://example.com/img.jpg');
            } catch {
              // expected
            }

            const updateCall = localMocks.prisma.message.update.mock.calls[0][0];
            expect(updateCall.data.status).toBe('FAILED');
            expect(typeof updateCall.data.error).toBe('string');
            expect(updateCall.data.error.length).toBeGreaterThan(0);
          },
        ),
        { numRuns: 100 },
      );
    });
  });
});
