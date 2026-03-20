import { Injectable } from '@nestjs/common';
import { randomBytes } from 'crypto';
import { PrismaService } from 'src/database/prisma.service';

@Injectable()
export class AuthService {
  constructor(private readonly prisma: PrismaService) {}

  async createApiKey(tenantId: string) {
    const key = randomBytes(32).toString('hex'); // 64 chars

    const apiKey = await this.prisma.apiKey.create({
      data: {
        tenantId,
        key,
      },
    });

    return apiKey;
  }

  async validateApiKey(key: string) {
    return this.prisma.apiKey.findUnique({
      where: { key },
    });
  }
}
