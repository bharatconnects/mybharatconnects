import {
  BadRequestException,
  Body,
  Controller,
  Delete,
  ForbiddenException,
  Get,
  NotFoundException,
  Param,
  Patch,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { UsersService } from './users.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import { Roles } from '../../common/decorators/roles.decorator';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { Role } from '../../common/enums/roles.enum';
import { Cluster } from '../../common/enums/cluster.enum';
import type { AuthenticatedUser } from '../auth/strategies/jwt.strategy';
import { CreateUserDto } from './dto/create-user.dto';
import { ChangePasswordDto, UpdateProfileDto } from './dto/update-profile.dto';
import { AdminUpdateUserDto } from './dto/admin-update-user.dto';
import { UserPresence } from './schemas/user.schema';

@ApiTags('users')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RolesGuard)
@Controller('users')
export class UsersController {
  constructor(private readonly usersService: UsersService) {}

  @Get()
  @Roles(Role.ADMIN, Role.CASE_MANAGER)
  @ApiOperation({ summary: 'List users (ADMIN and CASE_MANAGER)' })
  findAll(
    @Query('role') role?: Role,
    @Query('cluster') cluster?: Cluster,
    @Query('presence') presence?: UserPresence,
  ) {
    return this.usersService.findAll(role, cluster, presence);
  }

  @Post()
  @Roles(Role.ADMIN)
  @ApiOperation({
    summary: 'Create a user with a specific role (ADMIN only)',
  })
  async create(@Body() dto: CreateUserDto) {
    const existing = await this.usersService.findByEmail(dto.email);
    if (existing) {
      throw new BadRequestException('Email already registered');
    }
    return this.usersService.create(dto);
  }

  @Get('me')
  @ApiOperation({ summary: "Get the signed-in user's own profile" })
  async findMe(@CurrentUser() currentUser: AuthenticatedUser) {
    const user = await this.usersService.findById(currentUser.userId);
    if (!user) throw new NotFoundException('User not found');
    return user;
  }

  @Patch('me')
  @ApiOperation({ summary: "Update the signed-in user's own profile" })
  async updateMe(
    @CurrentUser() currentUser: AuthenticatedUser,
    @Body() dto: UpdateProfileDto,
  ) {
    const updated = await this.usersService.updateProfile(
      currentUser.userId,
      dto,
    );
    if (!updated) throw new NotFoundException('User not found');
    return updated;
  }

  @Patch('me/password')
  @ApiOperation({ summary: "Change the signed-in user's password" })
  async changeMyPassword(
    @CurrentUser() currentUser: AuthenticatedUser,
    @Body() dto: ChangePasswordDto,
  ) {
    try {
      await this.usersService.changePassword(
        currentUser.userId,
        dto.currentPassword,
        dto.newPassword,
      );
      return { message: 'Password updated' };
    } catch (err: unknown) {
      const e = err as { status?: number; message?: string };
      if (e?.status === 400) {
        throw new BadRequestException(e.message ?? 'Invalid current password');
      }
      throw err;
    }
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get a user by ID (ADMIN or self)' })
  async findOne(
    @Param('id') id: string,
    @CurrentUser() currentUser: AuthenticatedUser,
  ) {
    const isSelf = currentUser.userId === id;
    const isAdmin = currentUser.role === Role.ADMIN;

    if (!isSelf && !isAdmin) {
      throw new ForbiddenException('Access denied');
    }

    return this.usersService.findById(id);
  }

  @Patch(':id')
  @Roles(Role.ADMIN)
  @ApiOperation({ summary: 'Update user (ADMIN only)' })
  async updateByAdmin(
    @Param('id') id: string,
    @Body() dto: AdminUpdateUserDto,
    @CurrentUser() currentUser: AuthenticatedUser,
  ) {
    if (currentUser.userId === id && dto.isActive === false) {
      throw new BadRequestException('You cannot deactivate your own account');
    }

    const updated = await this.usersService.updateByAdmin(id, dto);
    if (!updated) throw new NotFoundException('User not found');
    return updated;
  }

  @Delete(':id')
  @Roles(Role.ADMIN)
  @ApiOperation({ summary: 'Delete user (ADMIN only)' })
  async deleteByAdmin(
    @Param('id') id: string,
    @CurrentUser() currentUser: AuthenticatedUser,
  ) {
    if (currentUser.userId === id) {
      throw new BadRequestException('You cannot delete your own account');
    }
    await this.usersService.deleteByAdmin(id);
    return { success: true };
  }
}
