import { Test, TestingModule } from '@nestjs/testing';
import * as fc from 'fast-check';
import { ValidationException } from '../../integrations/meta/errors';
import { MetaClient } from '../../integrations/meta/meta.client';
import { MediaService, MediaType } from './media.service';

const mockMetaClient = {
  sendMedia: jest.fn(),
};

describe('MediaService', () => {
  let service: MediaService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        MediaService,
        { provide: MetaClient, useValue: mockMetaClient },
      ],
    }).compile();

    service = module.get<MediaService>(MediaService);
    jest.clearAllMocks();
  });

  // ─── Unit tests: buildPayload ───────────────────────────────────────────────

  describe('buildPayload', () => {
    it('should build image payload with link', () => {
      const payload = service.buildPayload('image', 'https://example.com/img.jpg');
      expect(payload.type).toBe('image');
      expect((payload['image'] as Record<string, string>).link).toBe('https://example.com/img.jpg');
    });

    it('should include caption for image', () => {
      const payload = service.buildPayload('image', 'https://example.com/img.jpg', 'My caption');
      expect((payload['image'] as Record<string, string>).caption).toBe('My caption');
    });

    it('should include caption for document', () => {
      const payload = service.buildPayload('document', 'https://example.com/doc.pdf', 'My doc');
      expect((payload['document'] as Record<string, string>).caption).toBe('My doc');
    });

    it('should include filename for document', () => {
      const payload = service.buildPayload('document', 'https://example.com/doc.pdf', undefined, 'file.pdf');
      expect((payload['document'] as Record<string, string>).filename).toBe('file.pdf');
    });

    it('should NOT include caption for audio', () => {
      const payload = service.buildPayload('audio', 'https://example.com/audio.mp3', 'ignored');
      expect((payload['audio'] as Record<string, string>).caption).toBeUndefined();
    });

    it('should NOT include caption for video', () => {
      const payload = service.buildPayload('video', 'https://example.com/video.mp4', 'ignored');
      expect((payload['video'] as Record<string, string>).caption).toBeUndefined();
    });

    it('should NOT include filename for image', () => {
      const payload = service.buildPayload('image', 'https://example.com/img.jpg', undefined, 'file.jpg');
      expect((payload['image'] as Record<string, string>).filename).toBeUndefined();
    });

    it('should throw ValidationException for http:// URL', () => {
      expect(() => service.buildPayload('image', 'http://example.com/img.jpg')).toThrow(ValidationException);
    });

    it('should throw ValidationException for ftp:// URL', () => {
      expect(() => service.buildPayload('image', 'ftp://example.com/img.jpg')).toThrow(ValidationException);
    });

    it('should throw ValidationException for empty URL', () => {
      expect(() => service.buildPayload('image', '')).toThrow(ValidationException);
    });

    it('should throw ValidationException for URL without scheme', () => {
      expect(() => service.buildPayload('image', 'example.com/img.jpg')).toThrow(ValidationException);
    });
  });

  // ─── Unit tests: send ───────────────────────────────────────────────────────

  describe('send', () => {
    it('should delegate to MetaClient.sendMedia', async () => {
      mockMetaClient.sendMedia.mockResolvedValue({ messageId: 'msg-123' });

      const result = await service.send({
        accessToken: 'token',
        phoneNumberId: 'phone-id',
        to: '+5491112345678',
        mediaType: 'image',
        mediaUrl: 'https://example.com/img.jpg',
      });

      expect(mockMetaClient.sendMedia).toHaveBeenCalledTimes(1);
      expect(result).toEqual({ messageId: 'msg-123' });
    });

    it('should pass all params to MetaClient.sendMedia', async () => {
      mockMetaClient.sendMedia.mockResolvedValue({ messageId: 'msg-456' });

      const params = {
        accessToken: 'token',
        phoneNumberId: 'phone-id',
        to: '+5491112345678',
        mediaType: 'document' as MediaType,
        mediaUrl: 'https://example.com/doc.pdf',
        caption: 'My doc',
        filename: 'file.pdf',
      };

      await service.send(params);
      expect(mockMetaClient.sendMedia).toHaveBeenCalledWith(params);
    });
  });

  // ─── Property 11: Media payload structure ───────────────────────────────────

  it('Property 11: payload has correct type and nested link for any valid HTTPS URL', () => {
    // Feature: meta-api-integration, Property 11: Media payload structure
    const mediaTypes: MediaType[] = ['image', 'document', 'audio', 'video'];

    fc.assert(
      fc.property(
        fc.constantFrom(...mediaTypes),
        fc.webUrl({ validSchemes: ['https'] }),
        (mediaType, mediaUrl) => {
          const payload = service.buildPayload(mediaType, mediaUrl);

          expect(payload.type).toBe(mediaType);

          const nested = payload[mediaType] as Record<string, string>;
          expect(nested).toBeDefined();
          expect(typeof nested.link).toBe('string');
          expect(nested.link).toBe(mediaUrl);
        },
      ),
      { numRuns: 100 },
    );
  });

  // ─── Property 12: Media URL validation ─────────────────────────────────────

  it('Property 12: throws ValidationException for any non-https URL before HTTP call', () => {
    // Feature: meta-api-integration, Property 12: Media URL validation
    const mediaTypes: MediaType[] = ['image', 'document', 'audio', 'video'];

    const nonHttpsUrlArb = fc.oneof(
      fc.webUrl({ validSchemes: ['http', 'ftp'] }),
      fc.string().filter((s) => !s.startsWith('https://')),
    );

    fc.assert(
      fc.property(
        fc.constantFrom(...mediaTypes),
        nonHttpsUrlArb,
        (mediaType, mediaUrl) => {
          expect(() => service.buildPayload(mediaType, mediaUrl)).toThrow(ValidationException);
          // MetaClient must NOT have been called (buildPayload is sync, no HTTP)
          expect(mockMetaClient.sendMedia).not.toHaveBeenCalled();
        },
      ),
      { numRuns: 100 },
    );
  });
});
