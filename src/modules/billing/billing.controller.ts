import { Controller, Get, Post, Body, Query, Request, UseGuards } from '@nestjs/common';
import { BillingService } from './billing.service';
import { JwtAuthGuard } from 'src/common/guards/jwt-auth.guard';
import { RolesGuard } from 'src/common/guards/roles.guard';
import { Roles } from 'src/common/decorators/roles.decorator';
import { IsString, IsNumber, IsNotEmpty, Min } from 'class-validator';

class UpsertPriceDto {
  @IsString() @IsNotEmpty() countryCode: string;
  @IsString() @IsNotEmpty() category: string;
  @IsNumber() @Min(0) priceUsd: number;
}

@Controller('billing')
@UseGuards(JwtAuthGuard, RolesGuard)
export class BillingController {
  constructor(private readonly billingService: BillingService) {}

  @Get('summary')
  @Roles('ADMIN')
  getSummary(@Request() req, @Query('period') period?: string) {
    return this.billingService.getMonthlySummary(req.user.tenantId, period);
  }

  @Get('history')
  @Roles('ADMIN')
  getHistory(@Request() req) {
    return this.billingService.getBillingHistory(req.user.tenantId);
  }

  @Get('subscription')
  @Roles('ADMIN')
  getSubscription(@Request() req) {
    return this.billingService.getSubscription(req.user.tenantId);
  }

  @Post('subscription/activate')
  @Roles('ADMIN')
  activateMonthly(@Request() req) {
    return this.billingService.activateMonthly(req.user.tenantId);
  }

  // Precios de Meta — solo super-admin (podés agregar un rol SUPER_ADMIN después)
  @Get('meta-prices')
  @Roles('ADMIN')
  listPrices() {
    return this.billingService.listMetaPrices();
  }

  @Post('meta-prices')
  @Roles('ADMIN')
  upsertPrice(@Body() dto: UpsertPriceDto) {
    return this.billingService.upsertMetaPrice(dto.countryCode, dto.category, dto.priceUsd);
  }
}
