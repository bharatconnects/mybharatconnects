import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import {
  PLATFORM_SETTINGS_KEY,
  PlatformSettings,
  PlatformSettingsDocument,
} from './schemas/platform-settings.schema';
import { UpdatePaymentPolicyDto } from './dto/update-payment-policy.dto';

export interface PaymentPolicy {
  advancePercent: number;
  finalPaymentGateEnabled: boolean;
  deliveryGateEnabled: boolean;
  closeWindowHours: number;
  updatedAt?: Date;
  updatedBy?: string;
}

// What applies when nobody has saved a policy yet. Advance 0% keeps the
// original behaviour: a quote acceptance opens the case immediately.
export const DEFAULT_PAYMENT_POLICY: PaymentPolicy = {
  advancePercent: 0,
  finalPaymentGateEnabled: true,
  deliveryGateEnabled: true,
  closeWindowHours: 168,
};

@Injectable()
export class SettingsService {
  constructor(
    @InjectModel(PlatformSettings.name)
    private readonly settingsModel: Model<PlatformSettingsDocument>,
  ) {}

  async getPaymentPolicy(): Promise<PaymentPolicy> {
    const doc = await this.settingsModel.findOne({ key: PLATFORM_SETTINGS_KEY }).lean().exec();
    if (!doc) return { ...DEFAULT_PAYMENT_POLICY };
    return {
      advancePercent: doc.advancePercent ?? DEFAULT_PAYMENT_POLICY.advancePercent,
      finalPaymentGateEnabled:
        doc.finalPaymentGateEnabled ?? DEFAULT_PAYMENT_POLICY.finalPaymentGateEnabled,
      deliveryGateEnabled: doc.deliveryGateEnabled ?? DEFAULT_PAYMENT_POLICY.deliveryGateEnabled,
      closeWindowHours: doc.closeWindowHours ?? DEFAULT_PAYMENT_POLICY.closeWindowHours,
      updatedAt: (doc as { updatedAt?: Date }).updatedAt,
      updatedBy: doc.updatedBy?.toString(),
    };
  }

  async updatePaymentPolicy(dto: UpdatePaymentPolicyDto, adminUserId: string): Promise<PaymentPolicy> {
    const { note, ...fields } = dto;
    const changes = Object.fromEntries(
      Object.entries(fields).filter(([, value]) => value !== undefined),
    );
    if (Object.keys(changes).length > 0) {
      await this.settingsModel
        .findOneAndUpdate(
          { key: PLATFORM_SETTINGS_KEY },
          {
            $set: { ...changes, updatedBy: new Types.ObjectId(adminUserId) },
            $setOnInsert: { key: PLATFORM_SETTINGS_KEY },
            // Newest 50 changes only, so the document cannot grow without bound.
            $push: {
              history: {
                $each: [{ at: new Date(), by: new Types.ObjectId(adminUserId), changes, note }],
                $slice: -50,
              },
            },
          },
          { upsert: true, returnDocument: 'after' },
        )
        .exec();
    }
    return this.getPaymentPolicy();
  }
}
