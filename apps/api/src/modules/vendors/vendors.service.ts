import {
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import { Role } from '../../common/enums/roles.enum';
import { CreateVendorDto } from './dto/create-vendor.dto';
import { Vendor, VendorDocument } from './schemas/vendor.schema';

export interface VendorFilters {
  city?: string;
  serviceType?: string;
  isVerified?: boolean;
  isAvailable?: boolean;
}

export interface RoutingCriteria {
  city?: string;
  serviceType?: string;
  language?: string;
  minRating?: number;
  maxRating?: number;
}

@Injectable()
export class VendorsService {
  constructor(
    @InjectModel(Vendor.name)
    private readonly vendorModel: Model<VendorDocument>,
  ) {}

  async register(
    userId: string,
    dto: CreateVendorDto,
  ): Promise<VendorDocument> {
    const vendor = new this.vendorModel({
      ...dto,
      userId: new Types.ObjectId(userId),
    });
    return vendor.save();
  }

  async findById(id: string): Promise<VendorDocument> {
    const vendor = await this.vendorModel
      .findById(id)
      .populate('userId', 'name email')
      .exec();

    if (!vendor) {
      throw new NotFoundException(`Vendor #${id} not found`);
    }

    return vendor;
  }

  async findByUserId(userId: string): Promise<VendorDocument> {
    const vendor = await this.vendorModel
      .findOne({ userId: new Types.ObjectId(userId) })
      .exec();

    if (!vendor) {
      throw new NotFoundException(
        `Vendor profile for user #${userId} not found`,
      );
    }

    return vendor;
  }

  async updateAvailability(
    id: string,
    available: boolean,
    actor: { userId: string; role: Role | string },
  ): Promise<VendorDocument> {
    const vendor = await this.vendorModel.findById(id).exec();
    if (!vendor) {
      throw new NotFoundException(`Vendor #${id} not found`);
    }
    // A VENDOR may only toggle their own listing's availability — ADMIN can
    // toggle any.
    if (actor.role === Role.VENDOR && vendor.userId.toString() !== actor.userId) {
      throw new ForbiddenException('Not authorized for this vendor profile');
    }

    vendor.isAvailable = available;
    return vendor.save();
  }

  async updateByUserId(
    userId: string,
    patch: Partial<{
      businessName: string;
      serviceTypes: string[];
      cities: string[];
      languages: string[];
      maxConcurrentJobs: number;
    }>,
  ): Promise<VendorDocument> {
    const update: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(patch)) {
      if (v !== undefined) update[k] = v;
    }
    const vendor = await this.vendorModel
      .findOneAndUpdate({ userId: new Types.ObjectId(userId) }, update, {
        returnDocument: 'after',
      })
      .exec();
    if (!vendor) {
      throw new NotFoundException(
        `Vendor profile for user #${userId} not found`,
      );
    }
    return vendor;
  }

  async autoRoute(criteria: RoutingCriteria): Promise<VendorDocument[]> {
    const query: Record<string, unknown> = {
      isAvailable: true,
      isVerified: true,
      $expr: { $lt: ['$currentJobs', '$maxConcurrentJobs'] },
    };

    if (criteria.city) {
      const cities = criteria.city
        .split(',')
        .map((c) => c.trim())
        .filter(Boolean);
      if (cities.length === 1) {
        query['cities'] = cities[0];
      } else if (cities.length > 1) {
        query['cities'] = { $in: cities };
      }
    }
    if (criteria.serviceType) {
      query['serviceTypes'] = criteria.serviceType;
    }

    if (criteria.language) {
      query['languages'] = criteria.language;
    }

    if (criteria.minRating !== undefined || criteria.maxRating !== undefined) {
      const ratingRange: Record<string, number> = {};
      if (criteria.minRating !== undefined) {
        ratingRange['$gte'] = criteria.minRating;
      }
      if (criteria.maxRating !== undefined) {
        ratingRange['$lte'] = criteria.maxRating;
      }
      query['rating'] = ratingRange;
    }

    return this.vendorModel
      .find(query)
      .sort({ rating: -1, currentJobs: 1 })
      .limit(10)
      .populate('userId', 'name email')
      .exec();
  }

  async assignJob(vendorId: string): Promise<VendorDocument> {
    const vendor = await this.vendorModel
      .findByIdAndUpdate(
        vendorId,
        { $inc: { currentJobs: 1, totalJobs: 1 } },
        { returnDocument: 'after' },
      )
      .exec();

    if (!vendor) {
      throw new NotFoundException(`Vendor #${vendorId} not found`);
    }

    return vendor;
  }

  async completeJob(vendorId: string, rating: number): Promise<VendorDocument> {
    const vendor = await this.vendorModel.findById(vendorId).exec();

    if (!vendor) {
      throw new NotFoundException(`Vendor #${vendorId} not found`);
    }

    // Weighted average: new rating = (currentRating * completedJobs + newRating) / (completedJobs + 1)
    const newCompletedJobs = vendor.completedJobs + 1;
    const newRating =
      (vendor.rating * vendor.completedJobs + rating) / newCompletedJobs;

    const updatedVendor = await this.vendorModel
      .findByIdAndUpdate(
        vendorId,
        {
          $inc: { currentJobs: -1, completedJobs: 1 },
          rating: Math.round(newRating * 10) / 10,
        },
        { returnDocument: 'after' },
      )
      .exec();

    return updatedVendor!;
  }

  async verify(vendorId: string, adminId: string): Promise<VendorDocument> {
    const vendor = await this.vendorModel
      .findByIdAndUpdate(
        vendorId,
        {
          isVerified: true,
          verifiedBy: new Types.ObjectId(adminId),
        },
        { returnDocument: 'after' },
      )
      .exec();

    if (!vendor) {
      throw new NotFoundException(`Vendor #${vendorId} not found`);
    }

    return vendor;
  }

  async findAll(filters: VendorFilters): Promise<VendorDocument[]> {
    const query: Record<string, unknown> = {};

    if (filters.city) {
      query['cities'] = filters.city;
    }
    if (filters.serviceType) {
      query['serviceTypes'] = filters.serviceType;
    }
    if (filters.isVerified !== undefined) {
      query['isVerified'] = filters.isVerified;
    }
    if (filters.isAvailable !== undefined) {
      query['isAvailable'] = filters.isAvailable;
    }

    return this.vendorModel
      .find(query)
      .populate('userId', 'name email')
      .exec();
  }
}
