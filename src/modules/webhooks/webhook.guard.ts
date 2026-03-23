import {
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  Injectable,
  Logger,
  UnauthorizedException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { createHmac, timingSafeEqual } from 'crypto';

@Injectable()
export class WebhookGuard implements CanActivate {
  private readonly logger = new Logger(WebhookGuard.name);

  constructor(private readonly configService: ConfigService) {}

  canActivate(context: ExecutionContext): boolean {
    const req = context.switchToHttp().getRequest();
    const ip: string = req.ip ?? req.connection?.remoteAddress ?? 'unknown';

    const signatureHeader: string | undefined = req.headers['x-hub-signature-256'];

    if (!signatureHeader) {
      this.logger.warn(`Missing X-Hub-Signature-256 header from IP: ${ip}`);
      throw new UnauthorizedException('Missing X-Hub-Signature-256 header');
    }

    const appSecret = this.configService.get<string>('META_APP_SECRET') ?? '';
    const rawBody: Buffer = req.rawBody;

    const expectedHex = createHmac('sha256', appSecret).update(rawBody).digest('hex');
    const expectedSig = `sha256=${expectedHex}`;

    // Compare using timingSafeEqual to prevent timing attacks
    const expectedBuf = Buffer.from(expectedSig, 'utf8');
    const receivedBuf = Buffer.from(signatureHeader, 'utf8');

    const signaturesMatch =
      expectedBuf.length === receivedBuf.length &&
      timingSafeEqual(expectedBuf, receivedBuf);

    if (!signaturesMatch) {
      this.logger.warn(`Invalid webhook signature from IP: ${ip}`);
      throw new ForbiddenException('Invalid webhook signature');
    }

    return true;
  }
}
