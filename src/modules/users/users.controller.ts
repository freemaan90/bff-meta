import { Controller, Post, Get, Body, UseGuards, Request } from '@nestjs/common';
import { UsersService } from './users.service';
import { RegisterDto } from './dto/register.dto';
import { LoginDto } from './dto/login.dto';
import { JwtAuthGuard } from 'src/common/guards/jwt-auth.guard';
import { RolesGuard } from 'src/common/guards/roles.guard';
import { Roles } from 'src/common/decorators/roles.decorator';

@Controller('users')
export class UsersController {
  constructor(private readonly usersService: UsersService) {}

  @Post('register')
  register(@Body() dto: RegisterDto) {
    return this.usersService.register(dto);
  }

  @Post('login')
  login(@Body() dto: LoginDto) {
    return this.usersService.login(dto);
  }

  // Solo ADMIN puede crear agentes dentro de su tenant
  @Post('agents')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('ADMIN')
  createAgent(@Request() req, @Body() dto: LoginDto) {
    return this.usersService.createAgent(req.user.tenantId, dto);
  }

  @Get()
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('ADMIN')
  listUsers(@Request() req) {
    return this.usersService.listUsers(req.user.tenantId);
  }
}
