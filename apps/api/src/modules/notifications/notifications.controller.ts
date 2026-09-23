import {
  BadRequestException,
  Controller,
  Get,
  Param,
  Patch,
  Query,
  UseGuards,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiQuery, ApiTags } from '@nestjs/swagger';
import { ConfigService } from '@nestjs/config';
import { NotificationsService } from './notifications.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { Public } from '../../common/decorators/public.decorator';
import { UsersService } from '../users/users.service';
import { verifyUnsubscribeToken } from '../../common/utils/unsubscribe-token.util';

interface RequestUser {
  userId: string;
}

@ApiTags('notifications')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RolesGuard)
@Controller('notifications')
export class NotificationsController {
  constructor(
    private readonly notificationsService: NotificationsService,
    private readonly usersService: UsersService,
    private readonly config: ConfigService,
  ) {}

  @Get('unsubscribe')
  @Public()
  @ApiOperation({
    summary: 'One-click unsubscribe from nurture/re-engagement emails',
  })
  @ApiQuery({ name: 'u', required: true, description: 'User id' })
  @ApiQuery({ name: 't', required: true, description: 'Signed token' })
  async unsubscribe(@Query('u') userId?: string, @Query('t') token?: string) {
    if (!userId || !token) {
      throw new BadRequestException('Missing unsubscribe link parameters');
    }
    const secret = this.config.get<string>('JWT_SECRET') ?? '';
    if (!verifyUnsubscribeToken(userId, token, secret)) {
      throw new BadRequestException('Invalid or expired unsubscribe link');
    }
    await this.usersService.setMarketingEmailsOptOut(userId);
    return { message: 'You have been unsubscribed from these emails.' };
  }

  @Get()
  @ApiOperation({ summary: 'Get paginated notifications for current user' })
  @ApiQuery({ name: 'page', required: false, type: Number })
  @ApiQuery({ name: 'limit', required: false, type: Number })
  getUserNotifications(
    @CurrentUser() user: RequestUser,
    @Query('page') page?: string,
    @Query('limit') limit?: string,
  ) {
    return this.notificationsService.getUserNotifications(
      user.userId,
      page ? parseInt(page, 10) : 1,
      limit ? parseInt(limit, 10) : 20,
    );
  }

  @Get('unread-count')
  @ApiOperation({ summary: 'Get unread notification count for current user' })
  getUnreadCount(@CurrentUser() user: RequestUser) {
    return this.notificationsService
      .getUnreadCount(user.userId)
      .then((count) => ({ count }));
  }

  @Patch(':id/read')
  @ApiOperation({ summary: 'Mark a notification as read' })
  markRead(@Param('id') id: string, @CurrentUser() user: RequestUser) {
    return this.notificationsService
      .markRead(id, user.userId)
      .then(() => ({ message: 'Notification marked as read' }));
  }

  @Patch('read-all')
  @ApiOperation({ summary: 'Mark all notifications as read for current user' })
  markAllRead(@CurrentUser() user: RequestUser) {
    return this.notificationsService
      .markAllRead(user.userId)
      .then(() => ({ message: 'All notifications marked as read' }));
  }
}
