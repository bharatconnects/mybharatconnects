import {
  BadRequestException,
  Injectable,
  NotFoundException,
  ForbiddenException,
} from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import { Case, CaseDocument } from '../cases/schemas/case.schema';
import {
  Rating,
  RatingDocument,
  RatingType,
  ReviewerDetails,
  ShareConsent,
} from './schemas/rating.schema';
import { Testimonial, TestimonialDocument } from './schemas/testimonial.schema';
import { User, UserDocument } from '../users/schemas/user.schema';
import { Lead, LeadDocument } from '../leads/schemas/lead.schema';
import { ShareConsentDto, SubmitPlatformRatingDto } from './dto/feedback.dto';
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

// What shows in place of a customer's name when they chose not to share it.
export const ANONYMOUS_REVIEWER = 'A MyBharatConnects client';

/** Turns whatever the customer sent into a complete set of choices; anything missing means "do not share". */
export function toConsent(input?: Partial<ShareConsent> | ShareConsentDto | null): ShareConsent {
  return {
    name: input?.name === true,
    location: input?.location === true,
    service: input?.service === true,
    publish: input?.publish === true,
  };
}

/**
 * The only details of a review that may be shown publicly. With no recorded
 * choice (feedback from before sharing choices existed) everything the
 * customer entered stays as it was; with one, only what they switched on.
 */
export function visibleDetails(
  consent: ShareConsent | undefined | null,
  fields: { clientName: string; clientCountry?: string; serviceType?: string },
): { clientName: string; clientCountry?: string; serviceType?: string } {
  if (!consent) return { ...fields };
  return {
    clientName: consent.name && fields.clientName.trim() ? fields.clientName : ANONYMOUS_REVIEWER,
    clientCountry: consent.location ? fields.clientCountry : undefined,
    serviceType: consent.service ? fields.serviceType : undefined,
  };
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
    @InjectModel(User.name)
    private readonly userModel: Model<UserDocument>,
    @InjectModel(Lead.name)
    private readonly leadModel: Model<LeadDocument>,
  ) {}

  async submitRating(
    clientId: string,
    dto: SubmitRatingDto & {
      type: RatingType;
      targetId?: string;
      reviewer?: ReviewerDetails;
      shareConsent?: ShareConsent;
    },
  ): Promise<RatingDocument> {
    const rating = new this.ratingModel({
      reviewer: dto.reviewer,
      shareConsent: dto.shareConsent,
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
    dto: SubmitPlatformRatingDto,
  ): Promise<RatingDocument> {
    if (dto.caseId) {
      const caseDoc = await this.caseModel.findById(dto.caseId).select('clientId').exec();
      if (!caseDoc || caseDoc.clientId.toString() !== clientId) {
        throw new ForbiddenException('This case does not belong to you');
      }
    }
    const reviewer: ReviewerDetails = {
      displayName: dto.displayName?.trim() || undefined,
      location: dto.location?.trim() || undefined,
      serviceLabel: dto.serviceLabel?.trim() || undefined,
    };
    return this.submitRating(clientId, {
      starRating: dto.starRating,
      comment: dto.comment,
      caseId: dto.caseId,
      type: 'PLATFORM',
      reviewer,
      // No choices sent (an old client) keeps the original behaviour; a new
      // client always sends them, and anything not switched on stays private.
      shareConsent: dto.share ? toConsent(dto.share) : undefined,
    });
  }

  /**
   * What the feedback form starts with: the customer's name, the country they
   * gave when they enquired, and the service of the case the feedback is about
   * (their most recent one unless they pick another). All of it is theirs to
   * edit, and none of it is shared without their say-so.
   */
  async getPrefill(
    clientId: string,
    caseId?: string,
  ): Promise<{
    displayName: string;
    location: string | null;
    service: string | null;
    selectedCaseId: string | null;
    cases: { caseId: string; caseNumber: string; serviceType: string; status: string; createdAt?: Date }[];
  }> {
    const clientObjectId = new Types.ObjectId(clientId);
    const user = await this.userModel.findById(clientId).select('name email').exec();
    if (!user) throw new NotFoundException('User not found');

    const cases = await this.caseModel
      .find({ clientId: clientObjectId })
      .select('caseNumber serviceType status createdAt')
      .sort({ createdAt: -1 })
      .limit(25)
      .exec();

    const selected =
      (caseId && cases.find((c) => (c._id as Types.ObjectId).toString() === caseId)) || cases[0] || null;

    const lead = await this.leadModel
      .findOne({
        $or: [{ clientId: clientObjectId }, { email: user.email.toLowerCase() }],
        country: { $exists: true, $nin: [null, ''] },
      })
      .select('country')
      .sort({ createdAt: -1 })
      .exec();

    return {
      displayName: user.name,
      location: lead?.country ?? null,
      service: selected?.serviceType ?? null,
      selectedCaseId: selected ? (selected._id as Types.ObjectId).toString() : null,
      cases: cases.map((c) => ({
        caseId: (c._id as Types.ObjectId).toString(),
        caseNumber: c.caseNumber,
        serviceType: c.serviceType,
        status: c.status,
        createdAt: (c as unknown as { createdAt?: Date }).createdAt,
      })),
    };
  }

  /** The customer's own feedback, with their current sharing choices. */
  async findMyRatings(clientId: string) {
    const ratings = await this.ratingModel
      .find({ clientId: new Types.ObjectId(clientId) })
      .sort({ createdAt: -1 })
      .limit(50)
      .exec();
    const featured = await this.testimonialModel
      .find({
        ratingId: { $in: ratings.map((r) => r._id) },
        isApproved: true,
      })
      .select('ratingId')
      .exec();
    const featuredIds = new Set(featured.map((t) => t.ratingId.toString()));
    return ratings.map((r) => ({
      _id: (r._id as Types.ObjectId).toString(),
      type: r.type,
      starRating: r.starRating,
      comment: r.comment,
      reviewer: r.reviewer,
      shareConsent: r.shareConsent ?? null,
      featuredOnWebsite: featuredIds.has((r._id as Types.ObjectId).toString()),
      createdAt: (r as unknown as { createdAt?: Date }).createdAt,
    }));
  }

  /**
   * The customer changes their mind. Applies to the review itself and to any
   * testimonial already made from it: switching a detail off removes it from
   * the website straight away, and turning "feature my comment" off takes the
   * testimonial down.
   */
  async updateConsent(
    ratingId: string,
    clientId: string,
    dto: ShareConsentDto,
  ): Promise<RatingDocument> {
    const rating = await this.ratingModel.findById(ratingId).exec();
    if (!rating || rating.clientId.toString() !== clientId) {
      throw new ForbiddenException('This is not your feedback');
    }
    const current = toConsent(rating.shareConsent);
    const next: ShareConsent = {
      name: dto.name ?? current.name,
      location: dto.location ?? current.location,
      service: dto.service ?? current.service,
      publish: dto.publish ?? current.publish,
    };
    rating.shareConsent = next;
    if (!next.publish) {
      rating.isPublic = false;
    }
    await rating.save();

    await this.testimonialModel
      .updateMany(
        { ratingId: rating._id },
        { $set: { shareConsent: next, ...(next.publish ? {} : { isApproved: false }) } },
      )
      .exec();
    return rating;
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

    this.assertCanFeature(rating);
    const shown = visibleDetails(rating.shareConsent, dto);

    const testimonial = new this.testimonialModel({
      ratingId: new Types.ObjectId(ratingId),
      clientId: new Types.ObjectId(dto.clientId),
      clientName: shown.clientName,
      clientCountry: shown.clientCountry,
      content: dto.content,
      serviceType: shown.serviceType,
      shareConsent: rating.shareConsent,
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

  /** A review can only be featured if its author allowed it. Feedback from before sharing choices existed is unaffected. */
  private assertCanFeature(rating: RatingDocument): void {
    if (rating.shareConsent && !rating.shareConsent.publish) {
      throw new BadRequestException(
        'The customer has not agreed to have this feedback shown on the website.',
      );
    }
  }

  // Public, so it returns only what is meant to be seen: never the customer's
  // id, and only the details they agreed to share.
  async getPublicTestimonials(limit = 10): Promise<
    {
      _id: string;
      clientName: string;
      clientCountry?: string;
      content: string;
      serviceType?: string;
      ratingId?: { starRating?: number };
    }[]
  > {
    const safeLimit = Number.isFinite(limit) ? Math.min(Math.max(Math.trunc(limit), 1), 50) : 10;
    const rows = await this.testimonialModel
      .find({ isApproved: true })
      .populate('ratingId', 'starRating')
      .sort({ featuredOrder: 1 })
      .limit(safeLimit)
      .exec();
    return rows.map((t) => {
      // Plain fields, not the document itself: spreading a Mongoose document
      // would lose them.
      const shown = visibleDetails(t.shareConsent, {
        clientName: t.clientName,
        clientCountry: t.clientCountry,
        serviceType: t.serviceType,
      });
      const rating = t.ratingId as unknown as { starRating?: number } | null;
      return {
        _id: (t._id as Types.ObjectId).toString(),
        clientName: shown.clientName,
        clientCountry: shown.clientCountry,
        content: t.content,
        serviceType: shown.serviceType,
        ratingId: rating && typeof rating === 'object' ? { starRating: rating.starRating } : undefined,
      };
    });
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
      reviewer?: ReviewerDetails;
      shareConsent: ShareConsent | null;
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
        reviewer: row.reviewer,
        shareConsent: row.shareConsent ?? null,
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
    this.assertCanFeature(rating);
    // Whatever staff type, only the details the customer agreed to share are kept.
    const shown = visibleDetails(rating.shareConsent, dto);

    const testimonial = new this.testimonialModel({
      ratingId: new Types.ObjectId(ratingId),
      clientId: rating.clientId,
      clientName: shown.clientName,
      clientCountry: shown.clientCountry,
      content: dto.content,
      serviceType: shown.serviceType,
      shareConsent: rating.shareConsent,
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
