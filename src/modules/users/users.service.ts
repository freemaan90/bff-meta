import { Injectable, ConflictException, UnauthorizedException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import * as bcrypt from 'bcrypt';
import { PrismaService } from 'src/database/prisma.service';
import { RegisterDto } from './dto/register.dto';
import { UserRole } from 'src/generated/enums';
import { LoginDto } from './dto/login.dto';

@Injectable()
export class UsersService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly jwt: JwtService,
  ) {}

  async register(dto: RegisterDto) {
    const existing = await this.prisma.user.findUnique({ where: { email: dto.email } });
    if (existing) throw new ConflictException('Email already in use');

    const hashed = await bcrypt.hash(dto.password, 10);
    const trialEndsAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);

    // Crear tenant + user admin + subscription en una transacción
    const result = await this.prisma.$transaction(async (tx) => {
      const tenant = await tx.tenant.create({
        data: { name: dto.tenantName },
      });

      const user = await tx.user.create({
        data: {
          tenantId: tenant.id,
          email: dto.email,
          password: hashed,
          role: UserRole.ADMIN,
        },
      });

      await tx.subscription.create({
        data: {
          tenantId: tenant.id,
          trialEndsAt,
        },
      });

      return { tenant, user };
    });

    return this.signToken(result.user.id, result.user.tenantId, result.user.role);
  }

  async login(dto: LoginDto) {
    const user = await this.prisma.user.findUnique({ where: { email: dto.email } });
    if (!user) throw new UnauthorizedException('Invalid credentials');

    const valid = await bcrypt.compare(dto.password, user.password);
    if (!valid) throw new UnauthorizedException('Invalid credentials');

    return this.signToken(user.id, user.tenantId, user.role);
  }

  async createAgent(tenantId: string, dto: LoginDto) {
    const existing = await this.prisma.user.findUnique({ where: { email: dto.email } });
    if (existing) throw new ConflictException('Email already in use');

    const hashed = await bcrypt.hash(dto.password, 10);
    return this.prisma.user.create({
      data: { tenantId, email: dto.email, password: hashed, role: UserRole.AGENT },
      select: { id: true, email: true, role: true, createdAt: true },
    });
  }

  async listUsers(tenantId: string) {
    return this.prisma.user.findMany({
      where: { tenantId },
      select: { id: true, email: true, role: true, createdAt: true },
    });
  }

  private signToken(userId: string, tenantId: string, role: string) {
    const token = this.jwt.sign({ sub: userId, tenantId, role });
    return { access_token: token };
  }
}
