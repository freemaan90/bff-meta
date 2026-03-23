import * as fc from 'fast-check';
import { StructuredLogger } from './structured-logger';

// Helper: capture Logger calls by spying on the instance
function makeLogger() {
  const logger = new StructuredLogger('test');
  const calls: { level: string; message: string }[] = [];

  // Spy on the internal NestJS Logger methods
  const internal = (logger as any).logger;
  jest.spyOn(internal, 'log').mockImplementation((msg: string) => calls.push({ level: 'log', message: msg }));
  jest.spyOn(internal, 'error').mockImplementation((msg: string) => calls.push({ level: 'error', message: msg }));
  jest.spyOn(internal, 'warn').mockImplementation((msg: string) => calls.push({ level: 'warn', message: msg }));
  jest.spyOn(internal, 'debug').mockImplementation((msg: string) => calls.push({ level: 'debug', message: msg }));

  return { logger, calls };
}

describe('StructuredLogger', () => {
  afterEach(() => jest.restoreAllMocks());

  // ── Unit tests ──────────────────────────────────────────────────────────────

  describe('logRequest', () => {
    it('emits valid JSON with required fields at INFO level', () => {
      const { logger, calls } = makeLogger();
      logger.logRequest({ tenantId: 't1', phoneNumberId: 'p1', messageType: 'text' });

      expect(calls).toHaveLength(1);
      expect(calls[0].level).toBe('log');

      const parsed = JSON.parse(calls[0].message);
      expect(parsed.tenantId).toBe('t1');
      expect(parsed.phoneNumberId).toBe('p1');
      expect(parsed.messageType).toBe('text');
      expect(typeof parsed.timestamp).toBe('string');
      expect(typeof parsed.requestId).toBe('string');
    });

    it('uses provided requestId when given', () => {
      const { logger, calls } = makeLogger();
      logger.logRequest({ tenantId: 't1', phoneNumberId: 'p1', messageType: 'text', requestId: 'req-123' });
      const parsed = JSON.parse(calls[0].message);
      expect(parsed.requestId).toBe('req-123');
    });

    it('auto-generates requestId when not provided', () => {
      const { logger, calls } = makeLogger();
      logger.logRequest({ tenantId: 't1', phoneNumberId: 'p1', messageType: 'text' });
      const parsed = JSON.parse(calls[0].message);
      expect(parsed.requestId).toBeTruthy();
      expect(typeof parsed.requestId).toBe('string');
    });

    it('does NOT include accessToken or body content', () => {
      const { logger, calls } = makeLogger();
      logger.logRequest({ tenantId: 't1', phoneNumberId: 'p1', messageType: 'text' });
      const raw = calls[0].message;
      expect(raw).not.toContain('accessToken');
      expect(raw).not.toContain('body');
    });
  });

  describe('logSuccess', () => {
    it('emits valid JSON with messageId at INFO level', () => {
      const { logger, calls } = makeLogger();
      logger.logSuccess({ tenantId: 't1', phoneNumberId: 'p1', messageType: 'template', messageId: 'wamid.123' });

      expect(calls[0].level).toBe('log');
      const parsed = JSON.parse(calls[0].message);
      expect(parsed.messageId).toBe('wamid.123');
      expect(parsed.tenantId).toBe('t1');
    });
  });

  describe('logError', () => {
    it('emits valid JSON with error fields at ERROR level', () => {
      const { logger, calls } = makeLogger();
      logger.logError({
        tenantId: 't1',
        phoneNumberId: 'p1',
        messageType: 'text',
        fbtrace_id: 'fb-trace-abc',
        errorCode: 130429,
        errorType: 'RATE_LIMIT',
      });

      expect(calls[0].level).toBe('error');
      const parsed = JSON.parse(calls[0].message);
      expect(parsed.fbtrace_id).toBe('fb-trace-abc');
      expect(parsed.errorCode).toBe(130429);
      expect(parsed.errorType).toBe('RATE_LIMIT');
      expect(parsed.tenantId).toBe('t1');
    });
  });

  describe('logWebhookEvent', () => {
    it('emits valid JSON with eventType at DEBUG level', () => {
      const { logger, calls } = makeLogger();
      logger.logWebhookEvent({ eventType: 'messages', phoneNumberId: 'p1' });

      expect(calls[0].level).toBe('debug');
      const parsed = JSON.parse(calls[0].message);
      expect(parsed.eventType).toBe('messages');
      expect(parsed.phoneNumberId).toBe('p1');
    });
  });

  describe('logSignatureFailure', () => {
    it('emits valid JSON with sourceIp at WARN level', () => {
      const { logger, calls } = makeLogger();
      logger.logSignatureFailure({ sourceIp: '192.168.1.1' });

      expect(calls[0].level).toBe('warn');
      const parsed = JSON.parse(calls[0].message);
      expect(parsed.sourceIp).toBe('192.168.1.1');
    });
  });

  // ── Property-based test ─────────────────────────────────────────────────────

  // Feature: meta-api-integration, Property 23: Structured logger output shape
  describe('Property 23: logRequest output is valid JSON with required fields', () => {
    /**
     * Validates: Requirements 12.1
     *
     * For any outgoing Graph API request, the log entry emitted by StructuredLogger
     * SHALL be valid JSON and SHALL contain the fields: tenantId, phoneNumberId,
     * messageType, timestamp, and requestId.
     */
    it('should always emit valid JSON containing all required fields', () => {
      fc.assert(
        fc.property(
          fc.string({ minLength: 1 }),
          fc.string({ minLength: 1 }),
          fc.constantFrom('text', 'template', 'image', 'document', 'audio', 'video'),
          fc.option(fc.uuid(), { nil: undefined }),
          (tenantId, phoneNumberId, messageType, requestId) => {
            const { logger, calls } = makeLogger();

            logger.logRequest({ tenantId, phoneNumberId, messageType, requestId });

            expect(calls).toHaveLength(1);

            // Must be parseable as JSON
            let parsed: Record<string, unknown>;
            expect(() => {
              parsed = JSON.parse(calls[0].message);
            }).not.toThrow();

            parsed = JSON.parse(calls[0].message);

            // Must contain all required fields
            expect(typeof parsed['tenantId']).toBe('string');
            expect(typeof parsed['phoneNumberId']).toBe('string');
            expect(typeof parsed['messageType']).toBe('string');
            expect(typeof parsed['timestamp']).toBe('string');
            expect(typeof parsed['requestId']).toBe('string');

            // Values must match inputs
            expect(parsed['tenantId']).toBe(tenantId);
            expect(parsed['phoneNumberId']).toBe(phoneNumberId);
            expect(parsed['messageType']).toBe(messageType);

            // requestId: if provided use it, otherwise auto-generated (non-empty string)
            if (requestId !== undefined) {
              expect(parsed['requestId']).toBe(requestId);
            } else {
              expect((parsed['requestId'] as string).length).toBeGreaterThan(0);
            }

            // Must NOT contain sensitive fields
            expect(calls[0].message).not.toContain('accessToken');
          },
        ),
        { numRuns: 100 },
      );
    });
  });
});
