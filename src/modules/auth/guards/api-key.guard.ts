import { CanActivate, ExecutionContext, Injectable, UnauthorizedException } from '@nestjs/common';
import { AuthService } from '../auth.service';

@Injectable()
export class ApiKeyGuard implements CanActivate {
  constructor(private readonly authService: AuthService) {}

  async canActivate(context: ExecutionContext) {
    const req = context.switchToHttp().getRequest();
    const apiKey = req.headers['x-api-key'];

    if (!apiKey) {
      throw new UnauthorizedException('Missing API Key');
    }

    const valid = await this.authService.validateApiKey(apiKey);

    if (!valid) {
      throw new UnauthorizedException('Invalid API Key');
    }

    req.tenantId = valid.tenantId; // inyectamos tenantId en la request

    return true;
  }
}
