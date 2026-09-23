import {
  Injectable,
  NotFoundException,
  ForbiddenException,
} from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import { Case, CaseDocument } from '../cases/schemas/case.schema';
import { Rating, RatingDocument, RatingType } from './schemas/rating.schema';
import { Testimonial, TestimonialDocument } from './schemas/testimonial.schema';
import {
  Complaint,
  ComplaintDocument,
  ComplaintStatus,
} from './schemas/complaint.schema';

export interface SubmitRatingDto {
  caseId?: string;
  npsScore?: number;
  starRating?: number;
  criteriaRatings?: { criterion: string; score: number }[];
  comment?: string;
}

export interface CreateTestimonialDto {
  clientName: string;
  clientCountry?: string;
  content: string;
  serviceType?: string;
}

export interface SubmitComplaintDto {
  caseId?: string;
  category: 'SERVICE_QUALITY' | 'DELAY' | 'COMMUNICATION' | 'BILLING' | 'OTHER';
  subject: string;
  description: string;
}

@Injectable()
export class FeedbackService {
  constructor(
    @InjectModel(Rating.name)
    private readonly ratingModel: Model<RatingDocument>,
    @InjectModel(Testimonial.name)
    private readonly testimonialModel: Model<TestimonialDocument>,
    @InjectModel(Complaint.name)
    private readonly complaintModel: Model<ComplaintDocument>,
    @InjectModel(Case.name)
    private readonly caseModel: Model<CaseDocument>,
  ) {}

  async submitRating(
    clientId: string,
    dto: SubmitRatingDto & { type: RatingType; targetId?: string },
  ): Promise<RatingDocument> {
    const rating = new this.ratingModel({
      clientId: new Types.ObjectId(clientId),
      caseId: dto.caseId ? new Types.ObjectId(dto.caseId) : undefined,
      type: dto.type,
      targetId: dto.targetId ? new Types.ObjectId(dto.targetId) : undefined,
      npsScore: dto.npsScore,
      starRating: dto.starRating,
      criteriaRatings: dto.criteriaRatings ?? [],
      comment: dto.comment,
    });
    return rating.save();
  }

  async submitPlatformRating(
    clientId: string,
    dto: { starRating: number; comment?: string; caseId?: string },
  ): Promise<RatingDocument> {
    return this.submitRating(clientId, { ...dto, type: 'PLATFORM' });
  }

  async submitConsultantRating(
    clientId: string,
    caseManagerId: string,
    caseId: string,
    dto: SubmitRatingDto,
  ): Promise<RatingDocument> {
    const caseDoc = await this.caseModel
      .findById(caseId)
      .select('clientId caseManagerId')
      .exec();
    if (
      !caseDoc ||
      caseDoc.clientId.toString() !== clientId ||
      caseDoc.caseManagerId.toString() !== caseManagerId
    ) {
      throw new ForbiddenException(
        'This case is not associated with the given client and consultant',
      );
    }
    return this.submitRating(clientId, {
      ...dto,
      type: 'CONSULTANT',
      targetId: caseManagerId,
      caseId,
    });
  }

  async submitVendorRating(
    clientId: string,
    vendorId: string,
    caseId: string,
    dto: SubmitRatingDto,
  ): Promise<RatingDocument> {
    const caseDoc = await this.caseModel
      .findById(caseId)
      .select('clientId vendorId')
      .exec();
    if (
      !caseDoc ||
      caseDoc.clientId.toString() !== clientId ||
      caseDoc.vendorId?.toString() !== vendorId
    ) {
      throw new ForbiddenException(
        'This case is not associated with the given client and vendor',
      );
    }
    return this.submitRating(clientId, {
      ...dto,
      type: 'VENDOR',
      targetId: vendorId,
      caseId,
    });
  }

  async approveRating(
    ratingId: string,
    approvedByUserId: string,
  ): Promise<RatingDocument> {
    const rating = await this.ratingModel.findById(ratingId).exec();
    if (!rating) throw new NotFoundException(`Rating ${ratingId} not found`);

    rating.isApproved = true;
    rating.isPublic = true;
    rating.approvedBy = new Types.ObjectId(approvedByUserId);
    return rating.save();
  }

  async deleteRating(ratingId: string): Promise<{ deleted: boolean }> {
    const result = await this.ratingModel.findByIdAndDelete(ratingId).exec();
    if (!result) throw new NotFoundException(`Rating ${ratingId} not found`);
    return { deleted: true };
  }

  async createTestimonial(
    ratingId: string,
    dto: CreateTestimonialDto & { clientId: string },
  ): Promise<TestimonialDocument> {
    const rating = await this.ratingModel.findById(ratingId).exec();
    if (!rating) throw new NotFoundException(`Rating ${ratingId} not found`);
    if (rating.clientId.toString() !== dto.clientId) {
      throw new ForbiddenException(
        `Cannot create a testimonial for another client's rating`,
      );
    }

    const testimonial = new this.testimonialModel({
      ratingId: new Types.ObjectId(ratingId),
      clientId: new Types.ObjectId(dto.clientId),
      clientName: dto.clientName,
      clientCountry: dto.clientCountry,
      content: dto.content,
      serviceType: dto.serviceType,
    });
    return testimonial.save();
  }

  async approveTestimonial(
    testimonialId: string,
    adminId: string,
  ): Promise<TestimonialDocument> {
    const testimonial = await this.testimonialModel
      .findByIdAndUpdate(
        testimonialId,
        {
          isApproved: true,
          approvedBy: new Types.ObjectId(adminId),
        },
        { returnDocument: 'after' },
      )
      .populate('ratingId', 'starRating')
      .exec();
    if (!testimonial)
      throw new NotFoundException(`Testimonial ${testimonialId} not found`);
    return testimonial;
  }

  async hideTestimonial(testimonialId: string): Promise<TestimonialDocument> {
    const testimonial = await this.testimonialModel
      .findByIdAndUpdate(testimonialId, { isApproved: false }, { returnDocument: 'after' })
      .populate('ratingId', 'starRating')
      .exec();
    if (!testimonial)
      throw new NotFoundException(`Testimonial ${testimonialId} not found`);
    return testimonial;
  }

  async deleteTestimonial(testimonialId: string): Promise<{ deleted: boolean }> {
    const result = await this.testimonialModel
      .findByIdAndDelete(testimonialId)
      .exec();
    if (!result)
      throw new NotFoundException(`Testimonial ${testimonialId} not found`);
    return { deleted: true };
  }

  async getPublicTestimonials(limit = 10): Promise<TestimonialDocument[]> {
    return this.testimonialModel
      .find({ isApproved: true })
      .populate('ratingId', 'starRating')
      .sort({ featuredOrder: 1 })
      .limit(limit)
      .exec();
  }

  async findAllTestimonials(): Promise<TestimonialDocument[]> {
    return this.testimonialModel
      .find({})
      .populate('ratingId', 'starRating')
      .sort({ createdAt: -1 })
      .exec();
  }

  async findAllRatings(): Promise<
    Array<{
      _id: string;
      clientId: Types.ObjectId;
      rating: number;
      comment?: string;
      isApproved: boolean;
      createdAt?: Date;
      type: RatingType;
    }>
  > {
    const rows = await this.ratingModel
      .find({})
      .populate('clientId', 'name email')
      .sort({ createdAt: -1 })
      .exec();

    return rows.map((row) => {
      const normalized =
        typeof row.starRating === 'number'
          ? row.starRating
          : typeof row.npsScore === 'number'
            ? Math.max(1, Math.min(5, Math.round(row.npsScore / 2)))
            : 0;

      return {
        _id: row._id.toString(),
        clientId: row.clientId,
        rating: normalized,
        comment: row.comment,
        isApproved: row.isApproved,
        createdAt: (row as unknown as { createdAt?: Date }).createdAt,
        type: row.type,
      };
    });
  }

  async createTestimonialFromRating(
    ratingId: string,
    adminId: string,
    dto: {
      clientName: string;
      clientCountry?: string;
      content: string;
      serviceType?: string;
    },
  ): Promise<TestimonialDocument> {
    const rating = await this.ratingModel.findById(ratingId).exec();
    if (!rating) throw new NotFoundException(`Rating ${ratingId} not found`);

    const testimonial = new this.testimonialModel({
      ratingId: new Types.ObjectId(ratingId),
      clientId: rating.clientId,
      clientName: dto.clientName,
      clientCountry: dto.clientCountry,
      content: dto.content,
      serviceType: dto.serviceType,
      isApproved: true,
      approvedBy: new Types.ObjectId(adminId),
    });
    await testimonial.save();
    return testimonial.populate('ratingId', 'starRating');
  }

  async submitComplaint(
    userId: string,
    dto: SubmitComplaintDto,
  ): Promise<ComplaintDocument> {
    const complaint = new this.complaintModel({
      raisedBy: new Types.ObjectId(userId),
      caseId: dto.caseId ? new Types.ObjectId(dto.caseId) : undefined,
      category: dto.category,
      subject: dto.subject,
      description: dto.description,
    });
    return complaint.save();
  }

  async findMyComplaints(userId: string): Promise<ComplaintDocument[]> {
    return this.complaintModel
      .find({ raisedBy: new Types.ObjectId(userId) })
      .populate('assignedTo', 'name email')
      .populate('caseId', 'caseNumber')
      .sort({ createdAt: -1 })
      .exec();
  }

  async assignComplaint(
    complaintId: string,
    userId: string,
  ): Promise<ComplaintDocument> {
    const complaint = await this.complaintModel
      .findByIdAndUpdate(
        complaintId,
        {
          assignedTo: new Types.ObjectId(userId),
          status: 'IN_REVIEW',
        },
        { returnDocument: 'after' },
      )
      .exec();
    if (!complaint)
      throw new NotFoundException(`Complaint ${complaintId} not found`);
    return complaint;
  }

  async resolveComplaint(
    complaintId: string,
    resolution: string,
  ): Promise<ComplaintDocument> {
    const complaint = await this.complaintModel
      .findByIdAndUpdate(
        complaintId,
        {
          resolution,
          status: 'RESOLVED',
          resolvedAt: new Date(),
        },
        { returnDocument: 'after' },
      )
      .exec();
    if (!complaint)
      throw new NotFoundException(`Complaint ${complaintId} not found`);
    return complaint;
  }

  async getAverageRatings(
    targetId: string,
    type: RatingType,
  ): Promise<{
    averageNps: number;
    averageStar: number;
    criteriaAverages: { criterion: string; avgScore: number }[];
  }> {
    const targetObjectId = new Types.ObjectId(targetId);

    const result = await this.ratingModel.aggregate([
      { $match: { targetId: targetObjectId, type, isApproved: true } },
      {
        $group: {
          _id: null,
          averageNps: { $avg: '$npsScore' },
          averageStar: { $avg: '$starRating' },
          allCriteriaRatings: { $push: '$criteriaRatings' },
        },
      },
    ]);

    if (!result.length) {
      return { averageNps: 0, averageStar: 0, criteriaAverages: [] };
    }

    const { averageNps, averageStar, allCriteriaRatings } = result[0] as {
      averageNps: number;
      averageStar: number;
      allCriteriaRatings: { criterion: string; score: number }[][];
    };

    const flatCriteria = allCriteriaRatings.flat();
    const criteriaMap = new Map<string, number[]>();
    for (const { criterion, score } of flatCriteria) {
      const existing = criteriaMap.get(criterion) ?? [];
      existing.push(score);
      criteriaMap.set(criterion, existing);
    }

    const criteriaAverages = Array.from(criteriaMap.entries()).map(
      ([criterion, scores]) => ({
        criterion,
        avgScore: scores.reduce((a, b) => a + b, 0) / scores.length,
      }),
    );

    return { averageNps, averageStar, criteriaAverages };
  }

  async findAllComplaints(
    status?: ComplaintStatus,
  ): Promise<ComplaintDocument[]> {
    const filter: Record<string, unknown> = {};
    if (status) filter['status'] = status;
    return this.complaintModel
      .find(filter)
      .populate('raisedBy', 'name email role')
      .populate('assignedTo', 'name email')
      .populate('caseId', 'caseNumber')
      .sort({ createdAt: -1 })
      .exec();
  }
}
