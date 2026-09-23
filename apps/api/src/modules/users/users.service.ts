import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import * as bcrypt from 'bcrypt';
import { User, UserDocument } from './schemas/user.schema';
import { CreateUserDto } from './dto/create-user.dto';
import { Role } from '../../common/enums/roles.enum';
import { Cluster } from '../../common/enums/cluster.enum';
import { AdminUpdateUserDto } from './dto/admin-update-user.dto';
import { UserPresence } from './schemas/user.schema';

@Injectable()
export class UsersService {
  constructor(
    @InjectModel(User.name) private readonly userModel: Model<UserDocument>,
  ) {}

  async findByEmail(email: string): Promise<UserDocument | null> {
    return this.userModel
      .findOne({ email: email.toLowerCase() })
      .select('+password +refreshToken +passwordResetToken +otp +otpExpiry +otpAttempts')
      .exec();
  }

  async findById(id: string): Promise<UserDocument | null> {
    return this.userModel.findById(id).exec();
  }

  async findByGoogleId(googleId: string): Promise<UserDocument | null> {
    return this.userModel.findOne({ googleId }).exec();
  }

  async create(dto: CreateUserDto): Promise<UserDocument> {
    const hashedPassword = await bcrypt.hash(dto.password, 12);
    const user = new this.userModel({
      ...dto,
      email: dto.email.toLowerCase(),
      password: hashedPassword,
    });
    return user.save();
  }

  async createOauthUser(input: {
    email: string;
    name: string;
    googleId: string;
    role?: Role;
  }): Promise<UserDocument> {
    // Random unguessable password — user signs in via Google, never directly.
    const randomPassword = await bcrypt.hash(
      `oauth-${Date.now()}-${Math.random().toString(36).slice(2)}`,
      12,
    );
    const user = new this.userModel({
      email: input.email.toLowerCase(),
      password: randomPassword,
      name: input.name,
      googleId: input.googleId,
      role: input.role ?? Role.CLIENT,
      isActive: true,
    });
    return user.save();
  }

  async setGoogleId(userId: string, googleId: string): Promise<void> {
    await this.userModel.findByIdAndUpdate(userId, { googleId }).exec();
  }

  async updatePassword(userId: string, newPassword: string): Promise<void> {
    const hashedPassword = await bcrypt.hash(newPassword, 12);
    await this.userModel
      .findByIdAndUpdate(userId, {
        password: hashedPassword,
        passwordResetToken: null,
        passwordResetExpiry: null,
      })
      .exec();
  }

  async updateProfile(
    userId: string,
    patch: {
      name?: string;
      phone?: string | null;
      presence?: 'ONLINE' | 'AWAY';
      statusMessage?: string | null;
    },
  ): Promise<UserDocument | null> {
    const update: Record<string, unknown> = {};
    if (patch.name !== undefined) update.name = patch.name.trim();
    if (patch.phone !== undefined) {
      const trimmed = (patch.phone ?? '').trim();
      update.phone = trimmed.length ? trimmed : null;
    }
    if (patch.presence !== undefined) {
      update.presence = patch.presence;
      if (patch.presence === 'AWAY') update.lastSeenAt = new Date();
    }
    if (patch.statusMessage !== undefined) {
      const trimmed = (patch.statusMessage ?? '').trim();
      update.statusMessage = trimmed.length ? trimmed : null;
    }
    return this.userModel
      .findByIdAndUpdate(userId, update, { returnDocument: 'after' })
      .exec();
  }

  async changePassword(
    userId: string,
    currentPassword: string,
    newPassword: string,
  ): Promise<void> {
    const user = await this.userModel
      .findById(userId)
      .select('+password')
      .exec();
    if (!user) {
      throw new Error('User not found');
    }
    const ok = await bcrypt.compare(currentPassword, user.password);
    if (!ok) {
      const err = new Error('Current password is incorrect') as Error & {
        status?: number;
      };
      err.status = 400;
      throw err;
    }
    await this.updatePassword(userId, newPassword);
  }

  async setPasswordResetToken(
    userId: string,
    hashedToken: string,
    expiry: Date,
  ): Promise<void> {
    await this.userModel
      .findByIdAndUpdate(userId, {
        passwordResetToken: hashedToken,
        passwordResetExpiry: expiry,
      })
      .exec();
  }

  async clearPasswordResetToken(userId: string): Promise<void> {
    await this.userModel
      .findByIdAndUpdate(userId, {
        passwordResetToken: null,
        passwordResetExpiry: null,
      })
      .exec();
  }

  async updateRefreshToken(
    userId: string,
    token: string | null,
  ): Promise<void> {
    const hashed = token ? await bcrypt.hash(token, 10) : null;
    await this.userModel
      .findByIdAndUpdate(userId, { refreshToken: hashed })
      .exec();
  }

  async updateOtp(
    userId: string,
    otp: string | null,
    expiry: Date | null,
  ): Promise<void> {
    const update: Partial<{
      otp: string | null;
      otpExpiry: Date | null;
      otpAttempts: number;
    }> = { otp, otpExpiry: expiry };

    if (otp !== null) {
      update.otpAttempts = 0;
    }

    await this.userModel.findByIdAndUpdate(userId, update).exec();
  }

  async incrementOtpAttempts(userId: string): Promise<number> {
    const user = await this.userModel
      .findByIdAndUpdate(userId, { $inc: { otpAttempts: 1 } }, { returnDocument: 'after' })
      .select('+otpAttempts')
      .exec();
    return user ? user.otpAttempts : 0;
  }

  async findAll(
    role?: Role,
    cluster?: Cluster,
    presence?: UserPresence,
  ): Promise<UserDocument[]> {
    const filter: Record<string, unknown> = {};
    if (role) filter.role = role;
    if (cluster) filter.cluster = cluster;
    if (presence) filter.presence = presence;
    return this.userModel.find(filter).exec();
  }

  async findCaseManagersByCluster(cluster: Cluster): Promise<UserDocument[]> {
    return this.userModel.find({ role: Role.CASE_MANAGER, cluster }).exec();
  }

  async updateByAdmin(
    userId: string,
    dto: AdminUpdateUserDto,
  ): Promise<UserDocument | null> {
    const update: Record<string, unknown> = {};

    if (dto.email !== undefined) update.email = dto.email.toLowerCase();
    if (dto.name !== undefined) update.name = dto.name.trim();
    if (dto.phone !== undefined) {
      const trimmed = (dto.phone ?? '').trim();
      update.phone = trimmed.length ? trimmed : null;
    }
    if (dto.role !== undefined) update.role = dto.role;
    if (dto.cluster !== undefined) update.cluster = dto.cluster;
    if (dto.isActive !== undefined) update.isActive = dto.isActive;

    return this.userModel
      .findByIdAndUpdate(userId, update, { returnDocument: 'after' })
      .exec();
  }

  async deleteByAdmin(userId: string): Promise<void> {
    await this.userModel.findByIdAndDelete(userId).exec();
  }

  async setMarketingEmailsOptOut(userId: string): Promise<void> {
    await this.userModel
      .findByIdAndUpdate(userId, { marketingEmailsOptOut: true })
      .exec();
  }
}
