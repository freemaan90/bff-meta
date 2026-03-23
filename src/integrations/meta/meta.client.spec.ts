import * as fc from 'fast-check';
import { Test, TestingModule } from '@nestjs/testing';
import { ConfigService } from '@nestjs/config';
import axios from 'axios';
import { MetaClient } from './meta.client';
import { MetaApiError } from './errors';

jest.mock('axios');
const mockedAxios = axios as jest.Mocked<typeof axios>;

function makeConfigService(version = 'v20.0'): Partial<ConfigService> {
  return {
    get: jest.fn().mockReturnValue(version),
  };
}

async function buildClient(version = 'v20.0'): Promise<MetaClient> {
  const module: TestingModule = await Test.createTestingModule({
    providers: [
      MetaClient,
      { provide: ConfigService, useValue: makeConfigService(version) },
    ],
  }).compile();
  return module.get<MetaClient>(MetaClient);
}

describe('MetaClient', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('unit tests', () => {
    it('sendText returns messageId on success', async () => {
      mockedAxios.post = jest.fn().mockResolvedValue({
        data: { messages: [{ id: 'msg-123' }] },
      });

      const client = await buildClient();
      const result = await client.sendText({
        accessToken: 'token-abc',
        phoneNumberId: '1234567890',
        to: '+5491112345678',
        text: 'Hello',
      });

      expect(result.messageId).toBe('msg-123');
    });

    it('sendText throws MetaApiError on HTTP error', async () => {
      const axiosError = Object.assign(new Error('Bad request'), {
        isAxiosError: true,
        response: {
          data: {
            error: { code: 100, message: 'Invalid param', type: 'OAuthException', fbtrace_id: 'trace1' },
          },
        },
      });
      // Make it an AxiosError instance
      Object.setPrototypeOf(axiosError, (await import('axios')).AxiosError.prototype);
      mockedAxios.post = jest.fn().mockRejectedValue(axiosError);

      const client = await buildClient();
      await expect(
        client.sendText({ accessToken: 'tok', phoneNumberId: 'pid', to: '+1234567890', text: 'hi' }),
      ).rejects.toBeInstanceOf(MetaApiError);
    });

    it('sendTemplate includes template name and language in payload', async () => {
      mockedAxios.post = jest.fn().mockResolvedValue({
        data: { messages: [{ id: 'msg-456' }] },
      });

      const client = await buildClient();
      const result = await client.sendTemplate({
        accessToken: 'token',
        phoneNumberId: 'pid',
        to: '+5491112345678',
        template: 'hello_world',
        language: 'en_US',
      });

      expect(result.messageId).toBe('msg-456');
      const callPayload = (mockedAxios.post as jest.Mock).mock.calls[0][1];
      expect(callPayload.template.name).toBe('hello_world');
      expect(callPayload.template.language.code).toBe('en_US');
    });

    it('sendMedia constructs correct payload for image', async () => {
      mockedAxios.post = jest.fn().mockResolvedValue({
        data: { messages: [{ id: 'msg-789' }] },
      });

      const client = await buildClient();
      await client.sendMedia({
        accessToken: 'token',
        phoneNumberId: 'pid',
        to: '+5491112345678',
        mediaType: 'image',
        mediaUrl: 'https://example.com/img.jpg',
        caption: 'A caption',
      });

      const callPayload = (mockedAxios.post as jest.Mock).mock.calls[0][1];
      expect(callPayload.type).toBe('image');
      expect(callPayload.image.link).toBe('https://example.com/img.jpg');
      expect(callPayload.image.caption).toBe('A caption');
    });

    it('sendMedia includes filename for document type', async () => {
      mockedAxios.post = jest.fn().mockResolvedValue({
        data: { messages: [{ id: 'msg-doc' }] },
      });

      const client = await buildClient();
      await client.sendMedia({
        accessToken: 'token',
        phoneNumberId: 'pid',
        to: '+5491112345678',
        mediaType: 'document',
        mediaUrl: 'https://example.com/doc.pdf',
        filename: 'report.pdf',
      });

      const callPayload = (mockedAxios.post as jest.Mock).mock.calls[0][1];
      expect(callPayload.document.filename).toBe('report.pdf');
    });

    it('listTemplates returns array from response data', async () => {
      const templates = [{ id: 't1', name: 'tmpl', status: 'APPROVED', language: 'en_US' }];
      mockedAxios.get = jest.fn().mockResolvedValue({ data: { data: templates } });

      const client = await buildClient();
      const result = await client.listTemplates('waba-123', 'token');
      expect(result).toEqual(templates);
    });

    it('createTemplate returns id and status', async () => {
      mockedAxios.post = jest.fn().mockResolvedValue({ data: { id: 'tmpl-id', status: 'PENDING' } });

      const client = await buildClient();
      const result = await client.createTemplate('waba-123', 'token', {
        name: 'my_template',
        language: 'es',
        category: 'MARKETING',
      });

      expect(result.id).toBe('tmpl-id');
      expect(result.status).toBe('PENDING');
    });

    it('deleteTemplate calls DELETE with name param', async () => {
      mockedAxios.delete = jest.fn().mockResolvedValue({ data: {} });

      const client = await buildClient();
      await client.deleteTemplate('waba-123', 'token', 'my_template');

      expect(mockedAxios.delete).toHaveBeenCalledWith(
        expect.stringContaining('waba-123'),
        expect.objectContaining({ params: { name: 'my_template' } }),
      );
    });
  });

  describe('property tests', () => {
    // Feature: meta-api-integration, Property 1: MetaClient headers invariant
    it('should include Authorization and Content-Type headers in every request (text, template, media)', async () => {
      await fc.assert(
        fc.asyncProperty(
          fc.string({ minLength: 1, maxLength: 50 }),
          fc.string({ minLength: 1, maxLength: 20 }),
          fc.string({ minLength: 1, maxLength: 20 }),
          async (accessToken, phoneNumberId, to) => {
            jest.clearAllMocks();
            mockedAxios.post = jest.fn().mockResolvedValue({
              data: { messages: [{ id: 'msg-id' }] },
            });

            const client = await buildClient();
            await client.sendText({ accessToken, phoneNumberId, to, text: 'hello' });

            const callHeaders = (mockedAxios.post as jest.Mock).mock.calls[0][2].headers;
            expect(callHeaders['Authorization']).toBe(`Bearer ${accessToken}`);
            expect(callHeaders['Content-Type']).toBe('application/json');
          },
        ),
        { numRuns: 100 },
      );
    });

    // Feature: meta-api-integration, Property 1 (template variant): MetaClient headers invariant
    it('should include Authorization and Content-Type headers for template requests', async () => {
      await fc.assert(
        fc.asyncProperty(
          fc.string({ minLength: 1, maxLength: 50 }),
          fc.string({ minLength: 1, maxLength: 20 }),
          async (accessToken, phoneNumberId) => {
            jest.clearAllMocks();
            mockedAxios.post = jest.fn().mockResolvedValue({
              data: { messages: [{ id: 'msg-id' }] },
            });

            const client = await buildClient();
            await client.sendTemplate({
              accessToken,
              phoneNumberId,
              to: '+5491112345678',
              template: 'hello_world',
              language: 'en_US',
            });

            const callHeaders = (mockedAxios.post as jest.Mock).mock.calls[0][2].headers;
            expect(callHeaders['Authorization']).toBe(`Bearer ${accessToken}`);
            expect(callHeaders['Content-Type']).toBe('application/json');
          },
        ),
        { numRuns: 100 },
      );
    });

    // Feature: meta-api-integration, Property 1 (media variant): MetaClient headers invariant
    it('should include Authorization and Content-Type headers for media requests', async () => {
      await fc.assert(
        fc.asyncProperty(
          fc.string({ minLength: 1, maxLength: 50 }),
          fc.string({ minLength: 1, maxLength: 20 }),
          fc.constantFrom('image', 'document', 'audio', 'video') as fc.Arbitrary<
            'image' | 'document' | 'audio' | 'video'
          >,
          async (accessToken, phoneNumberId, mediaType) => {
            jest.clearAllMocks();
            mockedAxios.post = jest.fn().mockResolvedValue({
              data: { messages: [{ id: 'msg-id' }] },
            });

            const client = await buildClient();
            await client.sendMedia({
              accessToken,
              phoneNumberId,
              to: '+5491112345678',
              mediaType,
              mediaUrl: 'https://example.com/file',
            });

            const callHeaders = (mockedAxios.post as jest.Mock).mock.calls[0][2].headers;
            expect(callHeaders['Authorization']).toBe(`Bearer ${accessToken}`);
            expect(callHeaders['Content-Type']).toBe('application/json');
          },
        ),
        { numRuns: 100 },
      );
    });

    // Feature: meta-api-integration, Property 2: MetaClient URL version invariant
    it('should include META_API_VERSION in the constructed URL for any request', async () => {
      await fc.assert(
        fc.asyncProperty(
          fc.integer({ min: 1, max: 99 }).chain((major) =>
            fc.integer({ min: 0, max: 9 }).map((minor) => `v${major}.${minor}`),
          ),
          fc.string({ minLength: 1, maxLength: 20 }),
          async (version, phoneNumberId) => {
            jest.clearAllMocks();
            mockedAxios.post = jest.fn().mockResolvedValue({
              data: { messages: [{ id: 'msg-id' }] },
            });

            const client = await buildClient(version);
            await client.sendText({
              accessToken: 'token',
              phoneNumberId,
              to: '+5491112345678',
              text: 'hello',
            });

            const callUrl: string = (mockedAxios.post as jest.Mock).mock.calls[0][0];
            expect(callUrl).toContain(version);
          },
        ),
        { numRuns: 100 },
      );
    });

    // Feature: meta-api-integration, Property 2 (template variant): MetaClient URL version invariant
    it('should include META_API_VERSION in the URL for template operations', async () => {
      await fc.assert(
        fc.asyncProperty(
          fc.integer({ min: 1, max: 99 }).chain((major) =>
            fc.integer({ min: 0, max: 9 }).map((minor) => `v${major}.${minor}`),
          ),
          async (version) => {
            jest.clearAllMocks();
            mockedAxios.get = jest.fn().mockResolvedValue({ data: { data: [] } });

            const client = await buildClient(version);
            await client.listTemplates('waba-123', 'token');

            const callUrl: string = (mockedAxios.get as jest.Mock).mock.calls[0][0];
            expect(callUrl).toContain(version);
          },
        ),
        { numRuns: 100 },
      );
    });
  });
});
