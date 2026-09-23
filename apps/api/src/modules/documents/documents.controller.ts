import {
  Controller,
  Post,
  Get,
  Patch,
  Delete,
  Param,
  Body,
  Query,
  UseGuards,
} from '@nestjs/common';
import { ApiBearerAuth } from '@nestjs/swagger';
import { IsMongoId, IsOptional, IsString } from 'class-validator';
import { DocumentsService } from './documents.service';
import { RequestUploadDto } from './dto/request-upload.dto';
import { AddCommentDto } from './dto/add-comment.dto';
import { AnnotateDocumentDto } from './dto/annotate-document.dto';
import { SetDocumentsVisibilityDto } from './dto/set-documents-visibility.dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import { Roles } from '../../common/decorators/roles.decorator';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { Role } from '../../common/enums/roles.enum';
import type { AuthenticatedUser } from '../auth/strategies/jwt.strategy';

class FindDocumentsQueryDto {
  @IsOptional()
  @IsMongoId()
  caseId?: string;

  @IsOptional()
  @IsMongoId()
  clientId?: string;

  @IsOptional()
  @IsString()
  status?: string;
}

class RejectDocumentDto {
  @IsString()
  reason: string;
}

@UseGuards(JwtAuthGuard, RolesGuard)
@ApiBearerAuth()
@Controller('documents')
export class DocumentsController {
  constructor(private readonly documentsService: DocumentsService) {}

  @Get()
  @Roles(Role.CASE_MANAGER, Role.QA, Role.ADMIN)
  async findAll(@Query() query: FindDocumentsQueryDto) {
    return this.documentsService.findAll(query);
  }

  @Patch('visibility')
  @Roles(Role.CASE_MANAGER, Role.ADMIN)
  async setVisibility(
    @Body() dto: SetDocumentsVisibilityDto,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.documentsService.setVisibility(
      dto.documentIds,
      { clientVisible: dto.clientVisible, vendorVisible: dto.vendorVisible },
      user.userId,
    );
  }

  @Post('upload-request')
  @Roles(Role.CLIENT, Role.CASE_MANAGER, Role.VENDOR, Role.ADMIN)
  async requestUpload(
    @Body() dto: RequestUploadDto,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.documentsService.requestUploadUrl(dto, {
      userId: user.userId,
      role: user.role,
    });
  }

  @Post(':id/confirm')
  @Roles(Role.CLIENT, Role.CASE_MANAGER, Role.VENDOR, Role.ADMIN)
  async confirmUpload(@Param('id') id: string) {
    return this.documentsService.confirmUpload(id);
  }

  @Get('case/:caseId')
  @Roles(Role.CLIENT, Role.VENDOR, Role.CASE_MANAGER, Role.QA, Role.ADMIN)
  async findByCase(
    @Param('caseId') caseId: string,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.documentsService.findByCase(caseId, {
      userId: user.userId,
      role: user.role,
    });
  }

  // CLIENT-facing: returns documents from cases owned by the calling user.
  @Get('mine')
  @Roles(Role.CLIENT)
  async findMine(@CurrentUser() user: AuthenticatedUser) {
    return this.documentsService.findByClient(user.userId);
  }

  @Get(':id/download')
  @Roles(Role.CLIENT, Role.VENDOR, Role.CASE_MANAGER, Role.QA, Role.ADMIN)
  async getDownloadUrl(
    @Param('id') id: string,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.documentsService.getDownloadUrl(id, {
      userId: user.userId,
      role: user.role,
    });
  }

  @Get(':id')
  @Roles(Role.CLIENT, Role.VENDOR, Role.CASE_MANAGER, Role.QA, Role.ADMIN)
  async findById(
    @Param('id') id: string,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.documentsService.findById(id, {
      userId: user.userId,
      role: user.role,
    });
  }

  @Patch(':id/verify')
  @Roles(Role.QA, Role.ADMIN)
  async verify(
    @Param('id') id: string,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.documentsService.verify(id, user.userId);
  }

  @Patch(':id/reject')
  @Roles(Role.QA, Role.ADMIN)
  async reject(
    @Param('id') id: string,
    @Body() dto: RejectDocumentDto,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.documentsService.reject(id, user.userId, dto.reason);
  }

  @Delete(':id')
  @Roles(Role.CLIENT, Role.VENDOR, Role.CASE_MANAGER, Role.QA, Role.ADMIN)
  async delete(
    @Param('id') id: string,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.documentsService.delete(id, {
      userId: user.userId,
      role: user.role,
    });
  }

  @Post(':id/comments')
  async addComment(
    @Param('id') id: string,
    @Body() dto: AddCommentDto,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.documentsService.addComment(id, user.userId, dto);
  }

  @Patch(':id/annotate')
  @Roles(Role.CASE_MANAGER, Role.ADMIN)
  async annotate(@Param('id') id: string, @Body() dto: AnnotateDocumentDto) {
    return this.documentsService.setAnnotation(id, dto.annotation);
  }
}
