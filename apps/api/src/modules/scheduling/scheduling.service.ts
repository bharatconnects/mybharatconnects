import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import {
  AvailabilityWindow,
  AvailabilityWindowDocument,
} from './schemas/availability-window.schema';
import { Booking, BookingDocument } from './schemas/booking.schema';
import { AvailabilityWindowDto } from './dto/availability-window.dto';
import { BookSlotDto } from './dto/book-slot.dto';
import { Role } from '../../common/enums/roles.enum';
import { Case, CaseDocument } from '../cases/schemas/case.schema';

export interface OpenSlot {
  startAt: Date;
  endAt: Date;
}

@Injectable()
export class SchedulingService {
  constructor(
    @InjectModel(AvailabilityWindow.name)
    private readonly windowModel: Model<AvailabilityWindowDocument>,
    @InjectModel(Booking.name)
    private readonly bookingModel: Model<BookingDocument>,
    @InjectModel(Case.name)
    private readonly caseModel: Model<CaseDocument>,
  ) {}

  async setAvailability(
    userId: string,
    windows: AvailabilityWindowDto[],
  ): Promise<AvailabilityWindowDocument[]> {
    const ownerId = new Types.ObjectId(userId);
    // Bulk upsert by replacing the user's entire window set.
    await this.windowModel.deleteMany({ userId: ownerId }).exec();
    if (windows.length === 0) {
      return [];
    }
    const docs = windows.map((w) => ({
      userId: ownerId,
      dayOfWeek: w.dayOfWeek,
      startHour: w.startHour,
      endHour: w.endHour,
      timezone: w.timezone,
      slotMinutes: w.slotMinutes ?? 30,
    }));
    return this.windowModel.insertMany(docs);
  }

  async getAvailability(userId: string): Promise<AvailabilityWindowDocument[]> {
    return this.windowModel
      .find({ userId: new Types.ObjectId(userId) })
      .sort({ dayOfWeek: 1, startHour: 1 })
      .exec();
  }

  async getOpenSlots(
    userId: string,
    fromIso: string,
    toIso: string,
  ): Promise<OpenSlot[]> {
    const from = new Date(fromIso);
    const to = new Date(toIso);
    if (
      Number.isNaN(from.getTime()) ||
      Number.isNaN(to.getTime()) ||
      from >= to
    ) {
      throw new BadRequestException('Invalid from/to range');
    }
    const ownerId = new Types.ObjectId(userId);
    const [windows, existing] = await Promise.all([
      this.windowModel.find({ userId: ownerId }).exec(),
      this.bookingModel
        .find({
          hostUserId: ownerId,
          status: 'SCHEDULED',
          startAt: { $lt: to },
          endAt: { $gt: from },
        })
        .exec(),
    ]);

    if (windows.length === 0) {
      return [];
    }

    // Enumerate each UTC day between from..to, expand each window
    // (interpreted as UTC hours; timezone stored on the window for display).
    const slots: OpenSlot[] = [];
    const cursor = new Date(
      Date.UTC(
        from.getUTCFullYear(),
        from.getUTCMonth(),
        from.getUTCDate(),
        0,
        0,
        0,
        0,
      ),
    );
    const cap = new Date(to.getTime());

    while (cursor < cap) {
      const day = cursor.getUTCDay();
      const matches = windows.filter((w) => w.dayOfWeek === day);
      for (const w of matches) {
        const slotMs = (w.slotMinutes ?? 30) * 60 * 1000;
        const windowStart = new Date(
          Date.UTC(
            cursor.getUTCFullYear(),
            cursor.getUTCMonth(),
            cursor.getUTCDate(),
            w.startHour,
            0,
            0,
            0,
          ),
        );
        const windowEnd = new Date(
          Date.UTC(
            cursor.getUTCFullYear(),
            cursor.getUTCMonth(),
            cursor.getUTCDate(),
            w.endHour,
            0,
            0,
            0,
          ),
        );
        for (
          let t = windowStart.getTime();
          t + slotMs <= windowEnd.getTime();
          t += slotMs
        ) {
          const s = new Date(t);
          const e = new Date(t + slotMs);
          if (e <= from || s >= to) continue;
          const conflict = existing.some((b) => b.startAt < e && b.endAt > s);
          if (!conflict) {
            slots.push({ startAt: s, endAt: e });
          }
        }
      }
      // advance one UTC day
      cursor.setUTCDate(cursor.getUTCDate() + 1);
    }

    slots.sort((a, b) => a.startAt.getTime() - b.startAt.getTime());
    return slots;
  }

  async book(dto: BookSlotDto, createdBy: string): Promise<BookingDocument> {
    const startAt = new Date(dto.startAt);
    if (Number.isNaN(startAt.getTime())) {
      throw new BadRequestException('Invalid startAt');
    }
    const endAt = new Date(startAt.getTime() + dto.durationMinutes * 60 * 1000);
    const hostId = new Types.ObjectId(dto.hostUserId);

    // Re-run conflict check against any SCHEDULED bookings.
    const conflict = await this.bookingModel
      .findOne({
        hostUserId: hostId,
        status: 'SCHEDULED',
        startAt: { $lt: endAt },
        endAt: { $gt: startAt },
      })
      .exec();
    if (conflict) {
      throw new BadRequestException('Slot no longer available');
    }

    const created = new this.bookingModel({
      hostUserId: hostId,
      guestUserId: dto.guestUserId
        ? new Types.ObjectId(dto.guestUserId)
        : undefined,
      guestName: dto.guestName,
      guestEmail: dto.guestEmail,
      guestTimezone: dto.guestTimezone,
      caseId: dto.caseId ? new Types.ObjectId(dto.caseId) : undefined,
      purpose: dto.purpose,
      startAt,
      endAt,
      durationMinutes: dto.durationMinutes,
      status: 'SCHEDULED',
      notes: dto.notes,
      createdBy: new Types.ObjectId(createdBy),
    });
    return created.save();
  }

  async cancelBooking(
    id: string,
    actorUserId: string,
    actorRole: Role | string,
  ): Promise<BookingDocument> {
    const booking = await this.bookingModel.findById(id).exec();
    if (!booking) {
      throw new NotFoundException(`Booking ${id} not found`);
    }
    const isHost = booking.hostUserId.toString() === actorUserId;
    const isGuest =
      booking.guestUserId?.toString() === actorUserId ||
      booking.createdBy.toString() === actorUserId;
    const isAdmin = actorRole === Role.ADMIN;
    if (!isHost && !isGuest && !isAdmin) {
      throw new ForbiddenException(
        'Only host, guest, or ADMIN may cancel this booking',
      );
    }
    booking.status = 'CANCELLED';
    return booking.save();
  }

  async findByCase(
    caseId: string,
    actor: { userId: string; role: Role | string },
  ): Promise<BookingDocument[]> {
    if (actor.role === Role.CLIENT || actor.role === Role.CASE_MANAGER) {
      const caseDoc = await this.caseModel
        .findById(caseId)
        .select('clientId caseManagerId')
        .exec();
      const isParticipant =
        actor.role === Role.CLIENT
          ? caseDoc?.clientId.toString() === actor.userId
          : caseDoc?.caseManagerId.toString() === actor.userId;
      if (!isParticipant) {
        throw new ForbiddenException('Not authorized for this case');
      }
    }
    return this.bookingModel
      .find({ caseId: new Types.ObjectId(caseId) })
      .sort({ startAt: 1 })
      .exec();
  }

  async findByHost(hostUserId: string): Promise<BookingDocument[]> {
    return this.bookingModel
      .find({
        hostUserId: new Types.ObjectId(hostUserId),
        status: { $ne: 'CANCELLED' },
      })
      .sort({ startAt: 1 })
      .exec();
  }
}
