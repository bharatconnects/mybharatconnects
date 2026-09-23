import {
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import { Role } from '../../common/enums/roles.enum';
import { Case, CaseDocument } from '../cases/schemas/case.schema';
import { AddNoteDto } from './dto/add-note.dto';
import { CreateDisputeDto } from './dto/create-dispute.dto';
import { RejectDisputeDto } from './dto/reject-dispute.dto';
import { ResolveDisputeDto } from './dto/resolve-dispute.dto';
import {
  Dispute,
  DisputeDocument,
  DisputeStatus,
} from './schemas/dispute.schema';

@Injectable()
export class DisputesService {
  constructor(
    @InjectModel(Dispute.name)
    private readonly disputeModel: Model<DisputeDocument>,
    @InjectModel(Case.name)
    private readonly caseModel: Model<CaseDocument>,
  ) {}

  // Shared ownership check for CASE_MANAGER actors — mirrors
  // payments.service.ts's capturePayment() pattern. CLIENT is checked
  // separately (against dispute.raisedBy); ADMIN/OPS_FINANCE pass through.
  private async assertCaseManagerOwnsDispute(
    dispute: DisputeDocument,
    actorUserId: string,
    actorRole: Role | string,
  ): Promise<void> {
    if (actorRole !== Role.CASE_MANAGER) {
      return;
    }
    const caseDoc = await this.caseModel
      .findById(dispute.caseId)
      .select('caseManagerId')
      .exec();
    if (!caseDoc || caseDoc.caseManagerId.toString() !== actorUserId) {
      throw new ForbiddenException('Not authorized for this case');
    }
  }

  async create(
    dto: CreateDisputeDto,
    actorUserId: string,
    actorRole: Role | string,
  ): Promise<DisputeDocument> {
    if (actorRole === Role.CLIENT || actorRole === Role.CASE_MANAGER) {
      const caseDoc = await this.caseModel
        .findById(dto.caseId)
        .select('clientId caseManagerId')
        .exec();
      if (!caseDoc) {
        throw new NotFoundException(`Case #${dto.caseId} not found`);
      }
      const isParticipant =
        actorRole === Role.CLIENT
          ? caseDoc.clientId.toString() === actorUserId
          : caseDoc.caseManagerId.toString() === actorUserId;
      if (!isParticipant) {
        throw new ForbiddenException('Not authorized for this case');
      }
    }

    const raisedBy = new Types.ObjectId(actorUserId);
    const created = new this.disputeModel({
      caseId: new Types.ObjectId(dto.caseId),
      raisedBy,
      type: dto.type,
      status: DisputeStatus.OPEN,
      description: dto.description,
      evidenceDocumentIds: (dto.evidenceDocumentIds ?? []).map(
        (id) => new Types.ObjectId(id),
      ),
      timeline: [
        {
          at: new Date(),
          actorUserId: raisedBy,
          action: 'CREATED',
        },
      ],
    });
    return created.save();
  }

  async findAll(status?: DisputeStatus): Promise<DisputeDocument[]> {
    const query: Record<string, unknown> = {};
    if (status) {
      query.status = status;
    }
    return this.disputeModel
      .find(query)
      .populate('caseId', 'caseNumber')
      .sort({ createdAt: -1 })
      .exec();
  }

  async findById(
    id: string,
    actorUserId: string,
    actorRole: Role | string,
  ): Promise<DisputeDocument> {
    const dispute = await this.disputeModel
      .findById(id)
      .populate('caseId', 'caseNumber')
      .exec();
    if (!dispute) {
      throw new NotFoundException(`Dispute ${id} not found`);
    }

    // CLIENT may only view disputes they raised.
    if (
      actorRole === Role.CLIENT &&
      dispute.raisedBy.toString() !== actorUserId
    ) {
      throw new ForbiddenException(
        'Clients can only view disputes they raised',
      );
    }
    await this.assertCaseManagerOwnsDispute(dispute, actorUserId, actorRole);

    return dispute;
  }

  async addNote(
    id: string,
    dto: AddNoteDto,
    actorUserId: string,
    actorRole: Role | string,
  ): Promise<DisputeDocument> {
    const dispute = await this.disputeModel.findById(id).exec();
    if (!dispute) {
      throw new NotFoundException(`Dispute ${id} not found`);
    }
    await this.assertCaseManagerOwnsDispute(dispute, actorUserId, actorRole);

    dispute.timeline.push({
      at: new Date(),
      actorUserId: new Types.ObjectId(actorUserId),
      action: 'NOTE_ADDED',
      note: dto.note,
    });
    if (dispute.status === DisputeStatus.OPEN) {
      dispute.status = DisputeStatus.INVESTIGATING;
    }
    const saved = await dispute.save();
    return this.disputeModel
      .findById(saved._id)
      .populate('caseId', 'caseNumber')
      .exec() as Promise<DisputeDocument>;
  }

  async resolve(
    id: string,
    dto: ResolveDisputeDto,
    actorUserId: string,
    actorRole: Role | string,
  ): Promise<DisputeDocument> {
    const dispute = await this.disputeModel.findById(id).exec();
    if (!dispute) {
      throw new NotFoundException(`Dispute ${id} not found`);
    }
    await this.assertCaseManagerOwnsDispute(dispute, actorUserId, actorRole);

    const now = new Date();
    const actorId = new Types.ObjectId(actorUserId);
    dispute.status = DisputeStatus.RESOLVED;
    dispute.resolution = dto.resolution;
    dispute.resolvedAt = now;
    dispute.resolvedBy = actorId;
    dispute.timeline.push({
      at: now,
      actorUserId: actorId,
      action: 'RESOLVED',
      note: dto.resolution,
    });
    const saved = await dispute.save();
    return this.disputeModel
      .findById(saved._id)
      .populate('caseId', 'caseNumber')
      .exec() as Promise<DisputeDocument>;
  }

  async reject(
    id: string,
    dto: RejectDisputeDto,
    actorUserId: string,
    actorRole: Role | string,
  ): Promise<DisputeDocument> {
    const dispute = await this.disputeModel.findById(id).exec();
    if (!dispute) {
      throw new NotFoundException(`Dispute ${id} not found`);
    }
    await this.assertCaseManagerOwnsDispute(dispute, actorUserId, actorRole);

    const now = new Date();
    const actorId = new Types.ObjectId(actorUserId);
    dispute.status = DisputeStatus.REJECTED;
    dispute.resolution = dto.reason;
    dispute.resolvedAt = now;
    dispute.resolvedBy = actorId;
    dispute.timeline.push({
      at: now,
      actorUserId: actorId,
      action: 'REJECTED',
      note: dto.reason,
    });
    const saved = await dispute.save();
    return this.disputeModel
      .findById(saved._id)
      .populate('caseId', 'caseNumber')
      .exec() as Promise<DisputeDocument>;
  }
}
