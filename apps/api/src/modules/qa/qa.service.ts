import { Injectable, NotFoundException } from '@nestjs/common';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import { CaseEvents, CaseEventPayload } from '../../common/events/case-events';
import { QaReview, QaReviewDocument } from './schemas/qa-review.schema';

const STANDARD_CHECKLIST_ITEMS = [
  'All documents verified',
  'Vendor deliverables reviewed',
  'Payment reconciled',
  'Client agreement signed',
  'Closing pack ready',
];

export interface UpdateChecklistDto {
  checklist: { item: string; isPassed: boolean; note: string }[];
}

@Injectable()
export class QaService {
  constructor(
    @InjectModel(QaReview.name)
    private readonly qaReviewModel: Model<QaReviewDocument>,
    private readonly events: EventEmitter2,
  ) {}

  async createReview(
    caseId: string,
    qaLeadId: string,
  ): Promise<QaReviewDocument> {
    const checklist = STANDARD_CHECKLIST_ITEMS.map((item) => ({
      item,
      isPassed: false,
      note: '',
    }));

    const review = new this.qaReviewModel({
      caseId: new Types.ObjectId(caseId),
      qaLeadId: new Types.ObjectId(qaLeadId),
      checklist,
    });
    return review.save();
  }

  async updateChecklist(
    reviewId: string,
    qaLeadId: string,
    checklist: { item: string; isPassed: boolean; note: string }[],
  ): Promise<QaReviewDocument> {
    const review = await this.qaReviewModel
      .findByIdAndUpdate(
        reviewId,
        {
          checklist,
          qaLeadId: new Types.ObjectId(qaLeadId),
          status: 'IN_REVIEW',
        },
        { returnDocument: 'after' },
      )
      .populate('caseId', 'caseNumber title status serviceType')
      .populate('qaLeadId', 'name email')
      .exec();
    if (!review) throw new NotFoundException(`QA Review ${reviewId} not found`);
    return review;
  }

  async approve(
    reviewId: string,
    qaLeadId: string,
    note: string,
  ): Promise<QaReviewDocument> {
    const review = await this.qaReviewModel
      .findByIdAndUpdate(
        reviewId,
        {
          status: 'APPROVED',
          approvalNote: note,
          reviewedAt: new Date(),
          qaLeadId: new Types.ObjectId(qaLeadId),
        },
        { returnDocument: 'after' },
      )
      .populate('caseId', 'caseNumber title status serviceType')
      .populate('qaLeadId', 'name email')
      .exec();
    if (!review) throw new NotFoundException(`QA Review ${reviewId} not found`);

    const payload: CaseEventPayload = {
      caseId: review.caseId.toString(),
      actorUserId: qaLeadId,
    };
    this.events.emit(CaseEvents.QA_APPROVED, payload);

    return review;
  }

  async reject(
    reviewId: string,
    qaLeadId: string,
    reason: string,
    rejectedItems: string[],
  ): Promise<QaReviewDocument> {
    const review = await this.qaReviewModel
      .findByIdAndUpdate(
        reviewId,
        {
          status: 'REJECTED',
          rejectionReason: reason,
          rejectedItems,
          reviewedAt: new Date(),
          qaLeadId: new Types.ObjectId(qaLeadId),
        },
        { returnDocument: 'after' },
      )
      .populate('caseId', 'caseNumber title status serviceType')
      .populate('qaLeadId', 'name email')
      .exec();
    if (!review) throw new NotFoundException(`QA Review ${reviewId} not found`);

    const payload: CaseEventPayload = {
      caseId: review.caseId.toString(),
      actorUserId: qaLeadId,
      metadata: { reason, rejectedItems },
    };
    this.events.emit(CaseEvents.QA_REJECTED, payload);

    return review;
  }

  async findByCase(caseId: string): Promise<QaReviewDocument | null> {
    return this.qaReviewModel
      .findOne({ caseId: new Types.ObjectId(caseId) })
      .exec();
  }

  async findByQaLead(qaLeadId: string): Promise<QaReviewDocument[]> {
    return this.qaReviewModel
      .find({ qaLeadId: new Types.ObjectId(qaLeadId) })
      .exec();
  }

  async getPendingReviews(): Promise<QaReviewDocument[]> {
    return this.qaReviewModel
      .find({ status: { $in: ['PENDING', 'IN_REVIEW'] } })
      .populate('caseId', 'caseNumber title status serviceType')
      .populate('qaLeadId', 'name email')
      .exec();
  }

  async findAll(): Promise<QaReviewDocument[]> {
    return this.qaReviewModel
      .find()
      .populate('caseId', 'caseNumber title status serviceType')
      .populate('qaLeadId', 'name email')
      .sort({ updatedAt: -1 })
      .exec();
  }

  async findById(id: string): Promise<QaReviewDocument> {
    const review = await this.qaReviewModel
      .findById(id)
      .populate('caseId', 'caseNumber title status serviceType')
      .populate('qaLeadId', 'name email')
      .exec();
    if (!review) throw new NotFoundException(`QA Review ${id} not found`);
    return review;
  }
}
