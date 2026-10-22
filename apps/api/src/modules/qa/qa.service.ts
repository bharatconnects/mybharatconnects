import {
  BadRequestException,
  Injectable,
  Logger,
  NotFoundException,
  OnModuleInit,
} from '@nestjs/common';
import { EventEmitter2, OnEvent } from '@nestjs/event-emitter';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import { CaseEvents } from '../../common/events/case-events';
import type { CaseEventPayload } from '../../common/events/case-events';
import { CaseStatus } from '../../common/enums/case-status.enum';
import { Role } from '../../common/enums/roles.enum';
import { Case, CaseDocument } from '../cases/schemas/case.schema';
import { Document, DocumentDocument } from '../documents/schemas/document.schema';
import {
  QA_REVIEW_TYPES,
  QaReview,
  QaReviewDocument,
  QaReviewStatus,
  QaReviewType,
} from './schemas/qa-review.schema';
import { ChecklistEntryDto } from './dto/qa-review.dto';

// What QA looks at in each review. Written as things a person can tick off.
export const QA_CHECKLISTS: Record<QaReviewType, string[]> = {
  CLIENT_DOCUMENTS: [
    'All required client documents are uploaded',
    'Documents are legible and complete',
    'Identity details match the case records',
    'Property documents match the property in this case',
  ],
  VENDOR_DELIVERABLES: [
    'Deliverables match the accepted quote',
    'Every milestone is evidenced and marked complete',
    'Vendor documents are legible and complete',
    'Closing pack is ready',
  ],
};

const OPEN_STATUSES: QaReviewStatus[] = ['PENDING', 'IN_REVIEW'];

const freshChecklist = (type: QaReviewType) =>
  QA_CHECKLISTS[type].map((item) => ({ item, isPassed: false, note: '' }));

@Injectable()
export class QaService implements OnModuleInit {
  private readonly logger = new Logger(QaService.name);

  constructor(
    @InjectModel(QaReview.name)
    private readonly qaReviewModel: Model<QaReviewDocument>,
    @InjectModel(Case.name)
    private readonly caseModel: Model<CaseDocument>,
    @InjectModel(Document.name)
    private readonly documentModel: Model<DocumentDocument>,
    private readonly events: EventEmitter2,
  ) {}

  // Reviews used to be one per case, enforced by a unique index on caseId.
  // There are now two per case, so that index has to go and every existing
  // review is a vendor-deliverables review. Idempotent, and cheap once done.
  async onModuleInit(): Promise<void> {
    try {
      const collection = this.qaReviewModel.collection;
      const indexes: { name?: string; unique?: boolean }[] = await collection
        .indexes()
        .catch(() => []);
      if (indexes.some((i) => i.name === 'caseId_1' && i.unique)) {
        await collection.dropIndex('caseId_1');
        this.logger.log('Dropped the one-review-per-case index on qareviews');
      }
      const migrated = await this.qaReviewModel.updateMany(
        { reviewType: { $exists: false } },
        { $set: { reviewType: 'VENDOR_DELIVERABLES' } },
      );
      if (migrated.modifiedCount > 0) {
        this.logger.log(`Labelled ${migrated.modifiedCount} existing reviews as vendor deliverables`);
      }
    } catch (err) {
      this.logger.warn(
        `QA review migration skipped: ${err instanceof Error ? err.message : 'unknown error'}`,
      );
    }
  }

  /** Opens whichever of the case's reviews do not exist yet. Safe to call repeatedly and concurrently. */
  async ensureReviews(
    caseId: string,
    types: QaReviewType[] = QA_REVIEW_TYPES,
  ): Promise<QaReviewDocument[]> {
    const caseObjectId = new Types.ObjectId(caseId);
    const out: QaReviewDocument[] = [];
    for (const type of types) {
      try {
        const doc = await this.qaReviewModel
          .findOneAndUpdate(
            { caseId: caseObjectId, reviewType: type },
            { $setOnInsert: { status: 'PENDING', checklist: freshChecklist(type), rejectedItems: [] } },
            { upsert: true, returnDocument: 'after' },
          )
          .exec();
        out.push(doc);
      } catch (err) {
        // Two requests racing to create the same review: the loser reads the winner's.
        if ((err as { code?: number }).code !== 11000) throw err;
        const existing = await this.qaReviewModel
          .findOne({ caseId: caseObjectId, reviewType: type })
          .exec();
        if (existing) out.push(existing);
      }
    }
    return out;
  }

  async createReview(
    caseId: string,
    reviewType?: QaReviewType,
  ): Promise<QaReviewDocument | QaReviewDocument[]> {
    const exists = await this.caseModel.exists({ _id: caseId }).exec();
    if (!exists) {
      throw new NotFoundException(`Case ${caseId} not found`);
    }
    if (reviewType) {
      return (await this.ensureReviews(caseId, [reviewType]))[0];
    }
    return this.ensureReviews(caseId);
  }

  // A case arriving in QA review starts a round. Both reviews are opened; one
  // that was rejected last time starts again, and if everything had already
  // been approved (the case was sent back to QA by hand) both start again.
  // The earlier outcome is kept in `rounds`.
  @OnEvent(CaseEvents.QA_REVIEW_STARTED)
  async onQaReviewStarted(payload: CaseEventPayload): Promise<void> {
    try {
      const reviews = await this.ensureReviews(payload.caseId);
      const allApproved = reviews.length > 0 && reviews.every((r) => r.status === 'APPROVED');
      for (const review of reviews) {
        const restart = allApproved || review.status === 'REJECTED';
        if (!restart) continue;
        await this.qaReviewModel
          .updateOne(
            { _id: review._id, status: { $in: ['APPROVED', 'REJECTED'] } },
            {
              $push: {
                rounds: {
                  status: review.status,
                  reviewedAt: review.reviewedAt,
                  qaLeadId: review.qaLeadId,
                  note: review.approvalNote ?? review.rejectionReason,
                  rejectedItems: review.rejectedItems,
                },
              },
              $set: {
                status: 'PENDING',
                checklist: freshChecklist(review.reviewType),
                rejectedItems: [],
              },
              $unset: { approvalNote: '', rejectionReason: '', reviewedAt: '' },
            },
          )
          .exec();
      }
    } catch (err) {
      this.logger.error(
        `[${CaseEvents.QA_REVIEW_STARTED}] could not open reviews for case ${payload.caseId}: ${
          err instanceof Error ? err.message : 'unknown error'
        }`,
      );
    }
  }

  private async loadOpenReview(reviewId: string): Promise<QaReviewDocument> {
    const review = await this.qaReviewModel.findById(reviewId).exec();
    if (!review) throw new NotFoundException(`QA Review ${reviewId} not found`);
    if (!OPEN_STATUSES.includes(review.status)) {
      throw new BadRequestException(
        `This review is already ${review.status.toLowerCase()}. It reopens if the case comes back to QA.`,
      );
    }
    const caseDoc = await this.caseModel.findById(review.caseId).select('status').exec();
    if (!caseDoc || caseDoc.status !== CaseStatus.QA_REVIEW) {
      throw new BadRequestException('The case is not in QA review, so this review cannot be decided now.');
    }
    return review;
  }

  async updateChecklist(
    reviewId: string,
    qaLeadId: string,
    entries: ChecklistEntryDto[],
  ): Promise<QaReviewDocument> {
    const review = await this.loadOpenReview(reviewId);
    const known = new Set(review.checklist.map((c) => c.item));
    const unknown = entries.filter((e) => !known.has(e.item));
    if (unknown.length > 0) {
      throw new BadRequestException(`Not part of this checklist: ${unknown.map((u) => u.item).join(', ')}`);
    }
    for (const entry of entries) {
      const row = review.checklist.find((c) => c.item === entry.item)!;
      row.isPassed = entry.isPassed;
      row.note = entry.note ?? '';
    }
    review.status = 'IN_REVIEW';
    review.qaLeadId = new Types.ObjectId(qaLeadId);
    await review.save();
    return this.findById(reviewId);
  }

  async approve(reviewId: string, qaLeadId: string, note?: string): Promise<QaReviewDocument> {
    const review = await this.loadOpenReview(reviewId);
    const open = review.checklist.filter((c) => !c.isPassed);
    if (open.length > 0) {
      throw new BadRequestException(
        `Tick every checklist item before approving (${open.length} not yet passed). If something does not apply, tick it and say so in its note.`,
      );
    }
    review.status = 'APPROVED';
    review.approvalNote = note;
    review.reviewedAt = new Date();
    review.qaLeadId = new Types.ObjectId(qaLeadId);
    await review.save();

    // The case moves on only when every review of the case is approved.
    const caseId = review.caseId.toString();
    const all = await this.ensureReviews(caseId);
    if (all.every((r) => r.status === 'APPROVED')) {
      this.events.emit(CaseEvents.QA_APPROVED, {
        caseId,
        actorUserId: qaLeadId,
        metadata: { reviewTypes: all.map((r) => r.reviewType) },
      } satisfies CaseEventPayload);
    }
    return this.findById(reviewId);
  }

  async reject(
    reviewId: string,
    qaLeadId: string,
    reason: string,
    rejectedItems: string[] = [],
  ): Promise<QaReviewDocument> {
    const review = await this.loadOpenReview(reviewId);
    const known = new Set(review.checklist.map((c) => c.item));
    const stray = rejectedItems.filter((i) => !known.has(i));
    if (stray.length > 0) {
      throw new BadRequestException(`Not part of this checklist: ${stray.join(', ')}`);
    }
    review.status = 'REJECTED';
    review.rejectionReason = reason;
    review.rejectedItems = rejectedItems;
    review.reviewedAt = new Date();
    review.qaLeadId = new Types.ObjectId(qaLeadId);
    await review.save();

    this.events.emit(CaseEvents.QA_REJECTED, {
      caseId: review.caseId.toString(),
      actorUserId: qaLeadId,
      metadata: { reason, rejectedItems, reviewType: review.reviewType },
    } satisfies CaseEventPayload);
    return this.findById(reviewId);
  }

  async findByCase(caseId: string): Promise<QaReviewDocument[]> {
    return this.qaReviewModel.find({ caseId: new Types.ObjectId(caseId) }).exec();
  }

  async findByQaLead(qaLeadId: string): Promise<QaReviewDocument[]> {
    return this.qaReviewModel.find({ qaLeadId: new Types.ObjectId(qaLeadId) }).exec();
  }

  async getPendingReviews(reviewType?: QaReviewType): Promise<QaReviewDocument[]> {
    return this.qaReviewModel
      .find({
        status: { $in: OPEN_STATUSES },
        ...(reviewType ? { reviewType } : {}),
      })
      .populate('caseId', 'caseNumber title status serviceType')
      .populate('qaLeadId', 'name email')
      .exec();
  }

  async findAll(reviewType?: QaReviewType): Promise<QaReviewDocument[]> {
    return this.qaReviewModel
      .find(reviewType ? { reviewType } : {})
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

  /**
   * The documents this review is about, plus everything else on the case so
   * nothing is hidden. Client documents are reviewed in one review and vendor
   * documents in the other; what staff uploaded is internal and not reviewed.
   */
  async getReviewDocuments(reviewId: string) {
    const review = await this.qaReviewModel.findById(reviewId).select('caseId reviewType').exec();
    if (!review) throw new NotFoundException(`QA Review ${reviewId} not found`);

    const docs = await this.documentModel
      .find({ caseId: review.caseId })
      .populate('uploadedBy', 'name email role')
      .sort({ createdAt: -1 })
      .exec();

    const groupOf = (doc: DocumentDocument): QaReviewType | 'INTERNAL' => {
      const role = (doc.uploadedBy as unknown as { role?: string } | null)?.role;
      if (role === Role.CLIENT) return 'CLIENT_DOCUMENTS';
      if (role === Role.VENDOR) return 'VENDOR_DELIVERABLES';
      return 'INTERNAL';
    };

    return {
      reviewType: review.reviewType,
      documents: docs.filter((d) => groupOf(d) === review.reviewType),
      otherReview: docs.filter((d) => {
        const g = groupOf(d);
        return g !== review.reviewType && g !== 'INTERNAL';
      }),
      internal: docs.filter((d) => groupOf(d) === 'INTERNAL'),
    };
  }
}
