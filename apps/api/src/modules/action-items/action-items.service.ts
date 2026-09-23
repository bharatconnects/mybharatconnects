import {
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import {
  ActionItem,
  ActionItemDocument,
  ActionItemStatus,
} from './schemas/action-item.schema';
import { CreateActionItemDto } from './dto/create-action-item.dto';
import { Role } from '../../common/enums/roles.enum';
import { Case, CaseDocument } from '../cases/schemas/case.schema';

@Injectable()
export class ActionItemsService {
  constructor(
    @InjectModel(ActionItem.name)
    private readonly actionItemModel: Model<ActionItemDocument>,
    @InjectModel(Case.name)
    private readonly caseModel: Model<CaseDocument>,
  ) {}

  async create(
    caseId: string,
    dto: CreateActionItemDto,
    createdBy: string,
  ): Promise<ActionItemDocument> {
    const created = new this.actionItemModel({
      caseId: new Types.ObjectId(caseId),
      owner: new Types.ObjectId(dto.owner),
      text: dto.text,
      dueDate: dto.dueDate ? new Date(dto.dueDate) : undefined,
      status: 'OPEN' as ActionItemStatus,
      createdBy: new Types.ObjectId(createdBy),
    });
    const saved = await created.save();
    return this.actionItemModel
      .findById(saved._id)
      .populate('owner', 'name email')
      .exec() as Promise<ActionItemDocument>;
  }

  async findByCase(
    caseId: string,
    actor: { userId: string; role: Role | string },
  ): Promise<ActionItemDocument[]> {
    if (actor.role === Role.CASE_MANAGER || actor.role === Role.CLIENT) {
      const caseDoc = await this.caseModel
        .findById(caseId)
        .select('caseManagerId clientId')
        .exec();
      const isParticipant =
        actor.role === Role.CASE_MANAGER
          ? caseDoc?.caseManagerId.toString() === actor.userId
          : caseDoc?.clientId.toString() === actor.userId;
      if (!isParticipant) {
        throw new ForbiddenException('Not authorized for this case');
      }
    }
    return this.actionItemModel
      .find({ caseId: new Types.ObjectId(caseId) })
      .populate('owner', 'name email')
      .sort({ createdAt: -1 })
      .exec();
  }

  async updateStatus(
    id: string,
    status: ActionItemStatus,
    actorUserId: string,
    actorRole: Role | string,
  ): Promise<ActionItemDocument> {
    const item = await this.actionItemModel.findById(id).exec();
    if (!item) {
      throw new NotFoundException(`ActionItem ${id} not found`);
    }

    const isOwner = item.owner.toString() === actorUserId;
    const isCreator = item.createdBy.toString() === actorUserId;
    const isAdmin = actorRole === Role.ADMIN;
    if (!isOwner && !isCreator && !isAdmin) {
      throw new ForbiddenException(
        'Only the owner, creator, or ADMIN may update this action item',
      );
    }

    item.status = status;
    if (status === 'DONE') {
      item.completedAt = new Date();
    }
    await item.save();
    return this.actionItemModel
      .findById(id)
      .populate('owner', 'name email')
      .exec() as Promise<ActionItemDocument>;
  }

  async remove(id: string): Promise<void> {
    const result = await this.actionItemModel.findByIdAndDelete(id).exec();
    if (!result) {
      throw new NotFoundException(`ActionItem ${id} not found`);
    }
  }
}
