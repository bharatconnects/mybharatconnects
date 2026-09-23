import {
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import { Role } from '../../common/enums/roles.enum';
import { CreateFrqDto } from './dto/create-frq.dto';
import { Frq, FrqDocument, FrqStatus } from './schemas/frq.schema';

@Injectable()
export class FrqService {
  constructor(
    @InjectModel(Frq.name) private readonly frqModel: Model<FrqDocument>,
  ) {}

  // A CASE_MANAGER/CLIENT may only act on an FRQ they're actually a
  // participant in; ADMIN passes through. Mirrors the ownership pattern
  // used across payments/invoicing/disputes/cases.service.ts.
  private assertParticipant(
    frq: FrqDocument,
    actor: { userId: string; role: Role | string },
  ): void {
    if (actor.role === Role.ADMIN) {
      return;
    }
    const isOwner =
      (actor.role === Role.CASE_MANAGER &&
        frq.caseManagerId.toString() === actor.userId) ||
      (actor.role === Role.CLIENT &&
        frq.clientId?.toString() === actor.userId);
    if (!isOwner) {
      throw new ForbiddenException('Not authorized for this FRQ');
    }
  }

  async schedule(dto: CreateFrqDto): Promise<FrqDocument> {
    const frq = new this.frqModel({
      ...dto,
      leadId: new Types.ObjectId(dto.leadId),
      caseManagerId: new Types.ObjectId(dto.caseManagerId),
      clientId: dto.clientId ? new Types.ObjectId(dto.clientId) : undefined,
      status: FrqStatus.SCHEDULED,
    });
    return frq.save();
  }

  async complete(
    id: string,
    actor: { userId: string; role: Role | string },
    notes?: string,
    crossSellOpportunities?: string[],
  ): Promise<FrqDocument> {
    const existing = await this.frqModel.findById(id).exec();
    if (!existing) {
      throw new NotFoundException(`FRQ #${id} not found`);
    }
    this.assertParticipant(existing, actor);

    const updateData: Partial<{
      status: FrqStatus;
      completedAt: Date;
      notes: string;
      crossSellOpportunities: string[];
    }> = {
      status: FrqStatus.COMPLETED,
      completedAt: new Date(),
    };

    if (notes !== undefined) {
      updateData.notes = notes;
    }
    if (crossSellOpportunities !== undefined) {
      updateData.crossSellOpportunities = crossSellOpportunities;
    }

    const frq = await this.frqModel
      .findByIdAndUpdate(id, updateData, { returnDocument: 'after' })
      .exec();

    if (!frq) {
      throw new NotFoundException(`FRQ #${id} not found`);
    }

    return frq;
  }

  async findByLead(leadId: string): Promise<FrqDocument[]> {
    return this.frqModel
      .find({ leadId: new Types.ObjectId(leadId) })
      .populate('caseManagerId', 'name email')
      .exec();
  }

  async findByCaseManager(cmId: string): Promise<FrqDocument[]> {
    return this.frqModel
      .find({ caseManagerId: new Types.ObjectId(cmId) })
      .populate('leadId')
      .exec();
  }

  async findById(
    id: string,
    actor: { userId: string; role: Role | string },
  ): Promise<FrqDocument> {
    const frq = await this.frqModel
      .findById(id)
      .populate('leadId')
      .populate('caseManagerId', 'name email')
      .exec();

    if (!frq) {
      throw new NotFoundException(`FRQ #${id} not found`);
    }
    this.assertParticipant(frq, actor);

    return frq;
  }

  async cancel(
    id: string,
    actor: { userId: string; role: Role | string },
  ): Promise<FrqDocument> {
    const existing = await this.frqModel.findById(id).exec();
    if (!existing) {
      throw new NotFoundException(`FRQ #${id} not found`);
    }
    this.assertParticipant(existing, actor);

    const frq = await this.frqModel
      .findByIdAndUpdate(
        id,
        { status: FrqStatus.CANCELLED },
        { returnDocument: 'after' },
      )
      .exec();

    if (!frq) {
      throw new NotFoundException(`FRQ #${id} not found`);
    }

    return frq;
  }
}
