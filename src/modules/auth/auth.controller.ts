import { Controller, Post, Body } from '@nestjs/common';
import { AuthService } from './auth.service';
import { CreateApiKeyDto } from './dto/create-api-key.dto';

@Controller('auth')
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  @Post('api-keys')
  async createApiKey(@Body() dto: CreateApiKeyDto) {
    const apiKey = await this.authService.createApiKey(dto.tenantId);

    return {
      apiKey: apiKey.key,
      tenantId: apiKey.tenantId,
      createdAt: apiKey.createdAt,
    };
  }
}
