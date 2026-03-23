import * as fc from 'fast-check';
import { UnprocessableEntityException } from '@nestjs/common';
import { MetaApiError } from '../../integrations/meta/errors';
import { CreateTemplateDto } from '../../integrations/meta/types';
import { TemplateManager } from './template-manager.service';

// Mock PrismaService to avoid loading the generated Prisma client in tests
jest.mock('../../database/prisma.service', () => ({
  PrismaService: jest.fn(),
}));

// Mock MetaClient to avoid loading ConfigService / Redis in tests
jest.mock('../../integrations/meta/meta.client', () => ({
  MetaClient: jest.fn(),
}));

// ─── Helpers ────────────────────────────────────────────────────────────────

function makeTenant(wabaId = 'waba-123', accessToken = 'token-abc') {
  return {
    id: 'tenant-1',
    name: 'Test Tenant',
    accessToken,
    phoneNumberId: 'phone-id-123',
    wabaId,
    chatbotEnabled: false,
    chatbotMode: 'rules',
    chatbotRules: null,
    chatbotPrompt: null,
    createdAt: new Date(),
    updatedAt: new Date(),
  };
}

function makeMetaApiError(code = 100, fbtrace_id = 'trace-xyz') {
  return new MetaApiError({ code, message: 'Meta error', type: 'OAuthException', fbtrace_id });
}

function buildMocks() {
  const prisma = {
    tenant: { findUniqueOrThrow: jest.fn() },
  };

  const metaClient = {
    listTemplates: jest.fn(),
    createTemplate: jest.fn(),
    deleteTemplate: jest.fn(),
  };

  return { prisma, metaClient };
}

// ─── Unit tests ──────────────────────────────────────────────────────────────

describe('TemplateManager', () => {
  let service: TemplateManager;
  let mocks: ReturnType<typeof buildMocks>;

  beforeEach(() => {
    mocks = buildMocks();
    service = new TemplateManager(mocks.prisma as any, mocks.metaClient as any);
  });

  describe('list', () => {
    it('fetches tenant and calls MetaClient.listTemplates with wabaId and accessToken', async () => {
      const tenant = makeTenant('waba-999', 'tok-xyz');
      mocks.prisma.tenant.findUniqueOrThrow.mockResolvedValue(tenant);
      mocks.metaClient.listTemplates.mockResolvedValue([{ id: 't1', name: 'hello', status: 'APPROVED', language: 'es' }]);

      const result = await service.list('tenant-1');

      expect(mocks.metaClient.listTemplates).toHaveBeenCalledWith('waba-999', 'tok-xyz');
      expect(result).toHaveLength(1);
      expect(result[0].name).toBe('hello');
    });

    it('throws UnprocessableEntityException on MetaApiError', async () => {
      mocks.prisma.tenant.findUniqueOrThrow.mockResolvedValue(makeTenant());
      mocks.metaClient.listTemplates.mockRejectedValue(makeMetaApiError(131047, 'trace-1'));

      await expect(service.list('tenant-1')).rejects.toBeInstanceOf(UnprocessableEntityException);
    });

    it('rethrows non-MetaApiError errors', async () => {
      mocks.prisma.tenant.findUniqueOrThrow.mockResolvedValue(makeTenant());
      mocks.metaClient.listTemplates.mockRejectedValue(new Error('network error'));

      await expect(service.list('tenant-1')).rejects.toThrow('network error');
    });
  });

  describe('create', () => {
    const dto: CreateTemplateDto = {
      name: 'my_template',
      language: 'es',
      category: 'MARKETING',
      components: [],
    };

    it('calls MetaClient.createTemplate and returns id and status', async () => {
      mocks.prisma.tenant.findUniqueOrThrow.mockResolvedValue(makeTenant('waba-abc', 'tok-123'));
      mocks.metaClient.createTemplate.mockResolvedValue({ id: 'tpl-id-1', status: 'PENDING' });

      const result = await service.create('tenant-1', dto);

      expect(mocks.metaClient.createTemplate).toHaveBeenCalledWith('waba-abc', 'tok-123', dto);
      expect(result).toEqual({ id: 'tpl-id-1', status: 'PENDING' });
    });

    it('throws UnprocessableEntityException on MetaApiError', async () => {
      mocks.prisma.tenant.findUniqueOrThrow.mockResolvedValue(makeTenant());
      mocks.metaClient.createTemplate.mockRejectedValue(makeMetaApiError(100, 'trace-2'));

      await expect(service.create('tenant-1', dto)).rejects.toBeInstanceOf(UnprocessableEntityException);
    });

    it('includes MetaApiError details in UnprocessableEntityException', async () => {
      mocks.prisma.tenant.findUniqueOrThrow.mockResolvedValue(makeTenant());
      const metaError = new MetaApiError({ code: 200, message: 'Bad template', type: 'OAuthException', fbtrace_id: 'fb-trace' });
      mocks.metaClient.createTemplate.mockRejectedValue(metaError);

      let caught: UnprocessableEntityException | undefined;
      try {
        await service.create('tenant-1', dto);
      } catch (e) {
        caught = e as UnprocessableEntityException;
      }

      expect(caught).toBeInstanceOf(UnprocessableEntityException);
      const response = caught!.getResponse() as Record<string, unknown>;
      expect(response.code).toBe(200);
      expect(response.fbtrace_id).toBe('fb-trace');
    });
  });

  describe('delete', () => {
    it('calls MetaClient.deleteTemplate with correct args', async () => {
      mocks.prisma.tenant.findUniqueOrThrow.mockResolvedValue(makeTenant('waba-del', 'tok-del'));
      mocks.metaClient.deleteTemplate.mockResolvedValue(undefined);

      await service.delete('tenant-1', 'my_template');

      expect(mocks.metaClient.deleteTemplate).toHaveBeenCalledWith('waba-del', 'tok-del', 'my_template');
    });

    it('throws UnprocessableEntityException on MetaApiError', async () => {
      mocks.prisma.tenant.findUniqueOrThrow.mockResolvedValue(makeTenant());
      mocks.metaClient.deleteTemplate.mockRejectedValue(makeMetaApiError(100, 'trace-3'));

      await expect(service.delete('tenant-1', 'my_template')).rejects.toBeInstanceOf(
        UnprocessableEntityException,
      );
    });
  });

  // ─── Property 13: Template create round-trip ──────────────────────────────
  // Feature: meta-api-integration, Property 13: For any valid template definition sent to
  // TemplateManager.create, the Graph API call must be made to /{version}/{wabaId}/message_templates
  // and the returned result must contain an id and a status field.
  describe('Property 13: Template create round-trip', () => {
    it('should call createTemplate with wabaId and return result with id and status for any valid template', async () => {
      await fc.assert(
        fc.asyncProperty(
          // wabaId and accessToken
          fc.string({ minLength: 1, maxLength: 50 }),
          fc.string({ minLength: 1, maxLength: 50 }),
          // template definition
          fc.record({
            name: fc.stringMatching(/^[a-z][a-z0-9_]{0,29}$/),
            language: fc.constantFrom('es', 'en', 'pt_BR', 'fr'),
            category: fc.constantFrom('MARKETING', 'UTILITY', 'AUTHENTICATION'),
          }),
          // returned id and status from Graph API
          fc.string({ minLength: 1, maxLength: 50 }),
          fc.constantFrom('PENDING', 'APPROVED', 'REJECTED'),
          async (wabaId, accessToken, templateDef, returnedId, returnedStatus) => {
            const localMocks = buildMocks();
            const svc = new TemplateManager(localMocks.prisma as any, localMocks.metaClient as any);

            localMocks.prisma.tenant.findUniqueOrThrow.mockResolvedValue(
              makeTenant(wabaId, accessToken),
            );
            localMocks.metaClient.createTemplate.mockResolvedValue({
              id: returnedId,
              status: returnedStatus,
            });

            const result = await svc.create('tenant-1', templateDef as CreateTemplateDto);

            // The call must be made with the tenant's wabaId
            expect(localMocks.metaClient.createTemplate).toHaveBeenCalledWith(
              wabaId,
              accessToken,
              templateDef,
            );

            // Result must contain id and status
            expect(typeof result.id).toBe('string');
            expect(typeof result.status).toBe('string');
            expect(result.id).toBe(returnedId);
            expect(result.status).toBe(returnedStatus);
          },
        ),
        { numRuns: 100 },
      );
    });
  });
});
