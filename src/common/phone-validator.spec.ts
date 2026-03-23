import * as fc from 'fast-check';
import { PhoneValidator } from './phone-validator';
import { ValidationException } from '../integrations/meta/errors';

describe('PhoneValidator', () => {
  // ── Unit tests ──────────────────────────────────────────────────────────────

  describe('validate', () => {
    it('should return true for a valid E.164 number with +', () => {
      expect(PhoneValidator.validate('+5491112345678')).toBe(true);
    });

    it('should return false for a number without leading +', () => {
      expect(PhoneValidator.validate('5491112345678')).toBe(false);
    });

    it('should return false for an alphabetic string', () => {
      expect(PhoneValidator.validate('abc')).toBe(false);
    });

    it('should return false for a number that is too short (< 7 digits after country code)', () => {
      // +1 followed by only 5 digits → total 6 digits after + → invalid
      expect(PhoneValidator.validate('+112345')).toBe(false);
    });

    it('should return false for a number that is too long (> 15 digits total)', () => {
      expect(PhoneValidator.validate('+12345678901234567')).toBe(false);
    });

    it('should return false for +0... (country code cannot start with 0)', () => {
      expect(PhoneValidator.validate('+01234567')).toBe(false);
    });
  });

  describe('normalize', () => {
    it('should prepend + when missing', () => {
      expect(PhoneValidator.normalize('5491112345678')).toBe('+5491112345678');
    });

    it('should not double-prepend + when already present', () => {
      expect(PhoneValidator.normalize('+5491112345678')).toBe('+5491112345678');
    });
  });

  describe('validateOrThrow', () => {
    it('should return normalized number for a valid E.164 without +', () => {
      expect(PhoneValidator.validateOrThrow('5491112345678')).toBe('+5491112345678');
    });

    it('should return the same number for a valid E.164 with +', () => {
      expect(PhoneValidator.validateOrThrow('+5491112345678')).toBe('+5491112345678');
    });

    it('should throw ValidationException for an invalid string', () => {
      expect(() => PhoneValidator.validateOrThrow('abc')).toThrow(ValidationException);
      expect(() => PhoneValidator.validateOrThrow('abc')).toThrow('Invalid phone number format');
    });

    it('should throw ValidationException for an empty string', () => {
      expect(() => PhoneValidator.validateOrThrow('')).toThrow(ValidationException);
    });
  });

  // ── Property-based tests ─────────────────────────────────────────────────────

  // Feature: meta-api-integration, Property 16: Phone E.164 round-trip
  it('should validate any E.164 string (with or without +) after normalize', () => {
    // Validates: Requirements 8.6
    fc.assert(
      fc.property(
        fc.stringMatching(/^\+?[1-9]\d{6,14}$/),
        (phone) => {
          const normalized = PhoneValidator.normalize(phone);
          expect(PhoneValidator.validate(normalized)).toBe(true);
        },
      ),
      { numRuns: 100 },
    );
  });

  // Feature: meta-api-integration, Property 17: Invalid phone throws
  it('should throw ValidationException for any string that cannot be normalized to valid E.164', () => {
    // Validates: Requirements 8.3
    const invalidArb = fc.oneof(
      // strings with letters
      fc.stringMatching(/[a-zA-Z]/),
      // empty string
      fc.constant(''),
      // too short: + followed by 1-5 digits (total digits < 7 after country code digit)
      fc.stringMatching(/^\+?[1-9]\d{0,4}$/),
      // starts with 0 after optional +
      fc.stringMatching(/^\+?0\d+$/),
      // too long: more than 15 digits total
      fc.stringMatching(/^\+?[1-9]\d{15,}$/),
    );

    fc.assert(
      fc.property(invalidArb, (phone) => {
        expect(() => PhoneValidator.validateOrThrow(phone)).toThrow(ValidationException);
        expect(() => PhoneValidator.validateOrThrow(phone)).toThrow('Invalid phone number format');
      }),
      { numRuns: 100 },
    );
  });
});
