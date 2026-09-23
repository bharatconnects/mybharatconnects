import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument } from 'mongoose';
import { Role } from '../../../common/enums/roles.enum';
import { Cluster } from '../../../common/enums/cluster.enum';

export type UserDocument = HydratedDocument<User>;

export enum UserPresence {
  ONLINE = 'ONLINE',
  AWAY = 'AWAY',
}

@Schema({ timestamps: true })
export class User {
  @Prop({ type: String, unique: true, lowercase: true, required: true })
  email: string;

  @Prop({ type: String, required: true, select: false })
  password: string;

  @Prop({ type: String, enum: Role, default: Role.CLIENT })
  role: Role;

  @Prop({ type: String, required: true })
  name: string;

  @Prop({ type: String, default: null })
  phone?: string | null;

  @Prop({ type: String, enum: UserPresence, default: UserPresence.ONLINE })
  presence: UserPresence;

  @Prop({ type: String, maxlength: 160, default: null })
  statusMessage?: string | null;

  @Prop({ type: Date, default: null })
  lastSeenAt?: Date | null;

  @Prop({ type: Boolean, default: true })
  isActive: boolean;

  @Prop({ type: String, default: null, select: false })
  otp: string | null;

  @Prop({ type: Date, default: null, select: false })
  otpExpiry: Date | null;

  @Prop({ type: Number, default: 0, select: false })
  otpAttempts: number;

  @Prop({ type: String, default: null, select: false })
  refreshToken: string | null;

  @Prop({ type: String, unique: true, sparse: true })
  googleId?: string;

  @Prop({ type: String, select: false })
  passwordResetToken?: string | null;

  @Prop({ type: Date })
  passwordResetExpiry?: Date | null;

  @Prop({ type: String, enum: Cluster, required: false })
  cluster?: Cluster;

  // Suppresses nurture/re-engagement emails (not OTP, password reset, or
  // case/payment notifications — those are transactional, not marketing).
  @Prop({ type: Boolean, default: false })
  marketingEmailsOptOut: boolean;
}

export const UserSchema = SchemaFactory.createForClass(User);
