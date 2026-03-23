import * as fc from 'fast-check';
import { mapGraphApiError } from './error-mapper';
import { MetaApiError } from './errors';

describe('mapGraphApiError', () => {
  describe('unit tests', () => {
    it('maps code 130429 to RATE_LIMIT', () => {
      const result = mapGraphApiError({
        error: { code: 130429, message: 'Rate limit hit', type: 'OAuthException', fbtrace_id: 'abc123' },
      });
      expect(result).toBeInstanceOf(MetaApiError);
      expect(result.type).toBe('RATE_LIMIT');
      expect(result.code).toBe(130429);
      expect(result.fbtrace_id).toBe('abc123');
    });

    it('maps code 131047 to WINDOW_EXPIRED', () => {
      const result = mapGraphApiError({
        error: { code: 131047, message: 'Window expired', type: 'OAuthException', fbtrace_id: 'xyz' },
      });
      expect(result.type).toBe('WINDOW_EXPIRED');
      expect(result.code).toBe(131047);
    });

    it('uses error.type for unknown codes', () => {
      const result = mapGraphApiError({
        error: { code: 999, message: 'Some error', type: 'GraphMethodException', fbtrace_id: 'trace1' },
      });
      expect(result.type).toBe('GraphMethodException');
    });

    it('falls back to UNKNOWN when type is missing', () => {
      const result = mapGraphApiError({
        error: { code: 500, message: 'Server error', fbtrace_id: 'trace2' },
      });
      expect(result.type).toBe('UNKNOWN');
    });

    it('uses empty string for missing fbtrace_id', () => {
      const result = mapGraphApiError({
        error: { code: 200, message: 'Error', type: 'SomeType' },
      });
      expect(result.fbtrace_id).toBe('');
    });

    it('handles completely unknown input shape', () => {
      const result = mapGraphApiError(null);
      expect(result).toBeInstanceOf(MetaApiError);
      expect(result.fbtrace_id).toBe('');
      expect(result.type).toBe('UNKNOWN');
    });
  });

  describe('property tests', () => {
    // Feature: meta-api-integration, Property 5: ErrorMapper output shape
    it('should always produce a MetaApiError with all required fields', () => {
      fc.assert(
        fc.property(
          fc.record({
            error: fc.record({
              code: fc.integer(),
              message: fc.string(),
              type: fc.string(),
              fbtrace_id: fc.string(),
            }),
          }),
          (errorResponse) => {
            const result = mapGraphApiError(errorResponse);
            expect(result).toBeInstanceOf(MetaApiError);
            expect(typeof result.code).toBe('number');
            expect(typeof result.message).toBe('string');
            expect(typeof result.type).toBe('string');
            expect(typeof result.fbtrace_id).toBe('string');
          },
        ),
        { numRuns: 100 },
      );
    });

    it('should assign RATE_LIMIT for code 130429 regardless of other fields', () => {
      fc.assert(
        fc.property(
          fc.record({
            error: fc.record({
              code: fc.constant(130429),
              message: fc.string(),
              type: fc.string(),
              fbtrace_id: fc.string(),
            }),
          }),
          (errorResponse) => {
            const result = mapGraphApiError(errorResponse);
            expect(result.type).toBe('RATE_LIMIT');
          },
        ),
        { numRuns: 100 },
      );
    });

    it('should assign WINDOW_EXPIRED for code 131047 regardless of other fields', () => {
      fc.assert(
        fc.property(
          fc.record({
            error: fc.record({
              code: fc.constant(131047),
              message: fc.string(),
              type: fc.string(),
              fbtrace_id: fc.string(),
            }),
          }),
          (errorResponse) => {
            const result = mapGraphApiError(errorResponse);
            expect(result.type).toBe('WINDOW_EXPIRED');
          },
        ),
        { numRuns: 100 },
      );
    });
  });
});
