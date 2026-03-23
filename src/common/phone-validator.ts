import { ValidationException } from '../integrations/meta/errors';

const E164_REGEX = /^\+[1-9]\d{6,14}$/;

export class PhoneValidator {
  static validate(phone: string): boolean {
    return E164_REGEX.test(phone);
  }

  static normalize(phone: string): string {
    if (!phone.startsWith('+')) {
      return '+' + phone;
    }
    return phone;
  }

  static validateOrThrow(phone: string): string {
    const normalized = PhoneValidator.normalize(phone);
    if (!PhoneValidator.validate(normalized)) {
      throw new ValidationException('Invalid phone number format');
    }
    return normalized;
  }
}
