import { ExecutionContext, ForbiddenException, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { createHmac } from 'crypto';
import * as fc from 'fast-check';
import { WebhookGuard } from './webhook.guard';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function buildMockContext(
  rawBody: Buffer,
  signatureHeader: string | undefined,
  secret: string,
): ExecutionContext {
  const req: any = {
    rawBody,
    ip: '127.0.0.1',
    headers: {} as Record<string, string>,
  };
  if (signatureHeader !== undefined) {
    req.headers['x-hub-signature-256'] = signatureHeader;
  }

  return {
    switchToHttp: () => ({
      getRequest: () => req,
    }),
  } as unknown as ExecutionContext;
}

function computeSignature(body: Buffer | Uint8Array, secret: string): string {
  return 'sha256=' + createHmac('sha256', secret).update(body).digest('hex');
}

function makeGuard(secret: string): WebhookGuard {
  const configService = {
    get: (key: string) => (key === 'META_APP_SECRET' ? secret : undefined),
  } as unknown as ConfigService;
  return new WebhookGuard(configService);
}

// ---------------------------------------------------------------------------
// Unit tests
// ---------------------------------------------------------------------------

describe('WebhookGuard — unit tests', () => {
  const SECRET = 'test-secret-abc123';
  const BODY = Buffer.from('{"object":"whatsapp_business_account"}');

  it('should return true when signature is valid', () => {
    const guard = makeGuard(SECRET);
    const sig = computeSignature(BODY, SECRET);
    const ctx = buildMockContext(BODY, sig, SECRET);
    expect(guard.canActivate(ctx)).toBe(true);
  });

  it('should throw UnauthorizedException (401) when header is missing', () => {
    const guard = makeGuard(SECRET);
    const ctx = buildMockContext(BODY, undefined, SECRET);
    expect(() => guard.canActivate(ctx)).toThrow(UnauthorizedException);
  });

  it('should throw ForbiddenException (403) when signature is wrong', () => {
    const guard = makeGuard(SECRET);
    const ctx = buildMockContext(BODY, 'sha256=deadbeef', SECRET);
    expect(() => guard.canActivate(ctx)).toThrow(ForbiddenException);
  });

  it('should throw ForbiddenException when signature uses a different secret', () => {
    const guard = makeGuard(SECRET);
    const wrongSig = computeSignature(BODY, 'wrong-secret');
    const ctx = buildMockContext(BODY, wrongSig, SECRET);
    expect(() => guard.canActivate(ctx)).toThrow(ForbiddenException);
  });

  it('should throw ForbiddenException when body is tampered', () => {
    const guard = makeGuard(SECRET);
    const sig = computeSignature(BODY, SECRET);
    const tamperedBody = Buffer.from('{"object":"tampered"}');
    const ctx = buildMockContext(tamperedBody, sig, SECRET);
    expect(() => guard.canActivate(ctx)).toThrow(ForbiddenException);
  });

  it('should throw UnauthorizedException for empty string signature (treated as missing)', () => {
    const guard = makeGuard(SECRET);
    const ctx = buildMockContext(BODY, '', SECRET);
    // Empty string is falsy → treated as missing header → 401
    expect(() => guard.canActivate(ctx)).toThrow(UnauthorizedException);
  });
});

// ---------------------------------------------------------------------------
// Property 3: Webhook signature round-trip
// Feature: meta-api-integration, Property 3: Webhook signature round-trip
// ---------------------------------------------------------------------------

describe('WebhookGuard — Property 3: Webhook signature round-trip', () => {
  // For any body (Buffer) and any APP_SECRET, if the signature is computed as
  // sha256=HMAC-SHA256(body, secret) and sent in the header, WebhookGuard
  // SHALL allow the request to proceed.
  // Validates: Requirements 2.6

  it('should accept any payload signed with the correct secret', () => {
    fc.assert(
      fc.property(
        fc.uint8Array({ minLength: 1, maxLength: 10_000 }),
        fc.string({ minLength: 1, maxLength: 200 }),
        (bodyBytes, secret) => {
          const body = Buffer.from(bodyBytes);
          const sig = computeSignature(body, secret);
          const guard = makeGuard(secret);
          const ctx = buildMockContext(body, sig, secret);
          const result = guard.canActivate(ctx);
          return result === true;
        },
      ),
      { numRuns: 100 },
    );
  });
});

// ---------------------------------------------------------------------------
// Property 4: Webhook invalid signature rejection
// Feature: meta-api-integration, Property 4: Webhook invalid signature rejection
// ---------------------------------------------------------------------------

describe('WebhookGuard — Property 4: Webhook invalid signature rejection', () => {
  // For any body and any signature value that does NOT match
  // HMAC-SHA256(body, APP_SECRET), WebhookGuard SHALL reject with HTTP 403.
  // Validates: Requirements 2.3

  it('should reject any payload with a non-matching signature', () => {
    fc.assert(
      fc.property(
        fc.uint8Array({ minLength: 1, maxLength: 10_000 }),
        fc.string({ minLength: 1, maxLength: 200 }),
        fc.string({ minLength: 1, maxLength: 200 }),
        (bodyBytes, secret, wrongSecret) => {
          // Ensure the wrong secret actually produces a different signature
          fc.pre(wrongSecret !== secret);

          const body = Buffer.from(bodyBytes);
          const wrongSig = computeSignature(body, wrongSecret);
          const guard = makeGuard(secret);
          const ctx = buildMockContext(body, wrongSig, secret);

          try {
            guard.canActivate(ctx);
            return false; // should have thrown
          } catch (err) {
            return err instanceof ForbiddenException;
          }
        },
      ),
      { numRuns: 100 },
    );
  });

  it('should reject a valid body with a completely random hex signature', () => {
    fc.assert(
      fc.property(
        fc.uint8Array({ minLength: 1, maxLength: 10_000 }),
        fc.string({ minLength: 1, maxLength: 200 }),
        fc.stringMatching(/^[0-9a-f]{64}$/),
        (bodyBytes, secret, randomHex) => {
          const body = Buffer.from(bodyBytes);
          const correctSig = computeSignature(body, secret);
          const randomSig = `sha256=${randomHex}`;

          // Only test when the random sig differs from the correct one
          fc.pre(randomSig !== correctSig);

          const guard = makeGuard(secret);
          const ctx = buildMockContext(body, randomSig, secret);

          try {
            guard.canActivate(ctx);
            return false;
          } catch (err) {
            return err instanceof ForbiddenException;
          }
        },
      ),
      { numRuns: 100 },
    );
  });
});
