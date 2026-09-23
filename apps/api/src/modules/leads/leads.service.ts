import {
  BadRequestException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import { randomBytes } from 'crypto';
import { CreateLeadDto } from './dto/create-lead.dto';
import { UpdateLeadDto } from './dto/update-lead.dto';
import { UpdateLeadByClientDto } from './dto/update-lead-by-client.dto';
import {
  Lead,
  LeadDocument,
  LeadStatus,
  ServiceType,
} from './schemas/lead.schema';
import { Cluster, clusterForService } from '../../common/enums/cluster.enum';
import { EmailService } from '../notifications/notifications.email.service';
import { CasesService } from '../cases/cases.service';
import { CaseDocument } from '../cases/schemas/case.schema';
import { UsersService } from '../users/users.service';
import { Role } from '../../common/enums/roles.enum';

export interface LeadFilters {
  status?: LeadStatus;
  assignedCaseManager?: string;
  serviceType?: ServiceType;
  cluster?: Cluster;
  // Set for CASE_MANAGER callers so leads a CM has hidden drop out of their
  // own list — ADMIN never sets this, so it keeps seeing everything.
  excludeHidden?: boolean;
}

@Injectable()
export class LeadsService {
  private readonly logger = new Logger(LeadsService.name);

  constructor(
    @InjectModel(Lead.name) private readonly leadModel: Model<LeadDocument>,
    private readonly emailService: EmailService,
    private readonly casesService: CasesService,
    private readonly usersService: UsersService,
  ) {}

  async create(dto: CreateLeadDto, clientId?: string): Promise<LeadDocument> {
    const cluster =
      dto.cluster ??
      (dto.serviceType ? clusterForService(dto.serviceType) : undefined);
    const lead = new this.leadModel({
      ...dto,
      cluster,
      status: LeadStatus.COLD,
      clientId: clientId ? new Types.ObjectId(clientId) : undefined,
    });
    const saved = await lead.save();
    try {
      await this.emailService.sendLeadAcknowledgementEmail(
        saved.email,
        saved.name,
      );
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'unknown error';
      this.logger.error(`Lead acknowledgement email failed for ${saved.email}: ${msg}`);
    }
    return saved;
  }

  async findMineForClient(clientId: string): Promise<LeadDocument[]> {
    return this.leadModel
      .find({ clientId: new Types.ObjectId(clientId) })
      .populate('caseId', 'caseNumber status')
      .sort({ createdAt: -1 })
      .exec();
  }

  async cancelByClient(leadId: string, clientId: string): Promise<LeadDocument> {
    const lead = await this.leadModel.findById(leadId).exec();
    if (!lead) {
      throw new NotFoundException(`Lead #${leadId} not found`);
    }
    if (!lead.clientId || lead.clientId.toString() !== clientId) {
      throw new NotFoundException(`Lead #${leadId} not found`);
    }
    if (await this.hasLiveCase(lead)) {
      throw new BadRequestException(
        'This request has already turned into a case — cancel from the case instead',
      );
    }
    if (lead.status === LeadStatus.CANCELLED) {
      return lead;
    }
    lead.status = LeadStatus.CANCELLED;
    return lead.save();
  }

  async updateByClient(
    leadId: string,
    clientId: string,
    dto: UpdateLeadByClientDto,
  ): Promise<LeadDocument> {
    const lead = await this.leadModel.findById(leadId).exec();
    if (!lead) {
      throw new NotFoundException(`Lead #${leadId} not found`);
    }
    if (!lead.clientId || lead.clientId.toString() !== clientId) {
      throw new NotFoundException(`Lead #${leadId} not found`);
    }
    if (await this.hasLiveCase(lead)) {
      throw new BadRequestException(
        'This request has already turned into a case — edit it from the case instead',
      );
    }
    if (lead.status === LeadStatus.CANCELLED) {
      throw new BadRequestException('Cannot edit a cancelled request');
    }

    if (dto.name !== undefined) lead.name = dto.name;
    if (dto.email !== undefined) lead.email = dto.email;
    if (dto.phone !== undefined) lead.phone = dto.phone;
    if (dto.country !== undefined) lead.country = dto.country;
    if (dto.serviceType !== undefined) lead.serviceType = dto.serviceType;
    if (dto.message !== undefined) lead.message = dto.message;
    if (dto.timezone !== undefined) lead.timezone = dto.timezone;
    if (dto.intentTag !== undefined) lead.intentTag = dto.intentTag;

    return lead.save();
  }

  async findAll(filters: LeadFilters): Promise<LeadDocument[]> {
    const query: Record<string, unknown> = {};

    if (filters.status) {
      query['status'] = filters.status;
    }
    if (filters.assignedCaseManager) {
      query['assignedCaseManager'] = new Types.ObjectId(
        filters.assignedCaseManager,
      );
    }
    if (filters.serviceType) {
      query['serviceType'] = filters.serviceType;
    }
    if (filters.cluster) {
      query['cluster'] = filters.cluster;
    }
    if (filters.excludeHidden) {
      query['isHidden'] = { $ne: true };
    }

    return this.leadModel
      .find(query)
      .populate('assignedCaseManager', 'name email')
      .populate('caseId', 'caseNumber')
      .populate('hiddenBy', 'name email')
      .exec();
  }

  async hide(leadId: string, actorUserId: string): Promise<LeadDocument> {
    const lead = await this.leadModel
      .findByIdAndUpdate(
        leadId,
        {
          isHidden: true,
          hiddenBy: new Types.ObjectId(actorUserId),
          hiddenAt: new Date(),
        },
        { returnDocument: 'after' },
      )
      .populate('assignedCaseManager', 'name email')
      .populate('caseId', 'caseNumber')
      .populate('hiddenBy', 'name email')
      .exec();

    if (!lead) {
      throw new NotFoundException(`Lead #${leadId} not found`);
    }

    return lead;
  }

  async findByCluster(cluster: Cluster): Promise<LeadDocument[]> {
    return this.leadModel
      .find({ cluster })
      .populate('assignedCaseManager', 'name email')
      .populate('caseId', 'caseNumber')
      .exec();
  }

  async findById(id: string): Promise<LeadDocument> {
    const lead = await this.leadModel
      .findById(id)
      .populate('assignedCaseManager', 'name email')
      .populate('caseId')
      .exec();

    if (!lead) {
      throw new NotFoundException(`Lead #${id} not found`);
    }

    return lead;
  }

  async assign(leadId: string, caseManagerId: string): Promise<LeadDocument> {
    const lead = await this.leadModel
      .findByIdAndUpdate(
        leadId,
        {
          assignedCaseManager: new Types.ObjectId(caseManagerId),
          status: LeadStatus.WARM,
        },
        { returnDocument: 'after' },
      )
      .exec();

    if (!lead) {
      throw new NotFoundException(`Lead #${leadId} not found`);
    }

    try {
      const cm = await this.usersService.findById(caseManagerId);
      if (cm) {
        await this.emailService.sendLeadAssignedClientEmail(
          lead.email,
          lead.name,
          cm.name,
        );
        await this.emailService.sendLeadAssignedCmEmail(
          cm.email,
          cm.name,
          lead.name,
          lead.serviceType,
        );
      }
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'unknown error';
      this.logger.error(`Lead-assignment emails failed for lead ${leadId}: ${msg}`);
    }

    return lead;
  }

  async markLost(leadId: string, reason: string): Promise<LeadDocument> {
    const lead = await this.leadModel
      .findByIdAndUpdate(
        leadId,
        {
          status: LeadStatus.COLD,
          lostReason: reason,
        },
        { returnDocument: 'after' },
      )
      .exec();

    if (!lead) {
      throw new NotFoundException(`Lead #${leadId} not found`);
    }

    return lead;
  }

  async convert(leadId: string, caseId: string): Promise<LeadDocument> {
    const lead = await this.leadModel
      .findByIdAndUpdate(
        leadId,
        {
          status: LeadStatus.HOT,
          caseId: new Types.ObjectId(caseId),
        },
        { returnDocument: 'after' },
      )
      .populate('caseId', 'caseNumber')
      .exec();

    if (!lead) {
      throw new NotFoundException(`Lead #${leadId} not found`);
    }

    return lead;
  }

  async update(leadId: string, dto: UpdateLeadDto): Promise<LeadDocument> {
    const patch: Record<string, unknown> = {};

    if (dto.status !== undefined) patch['status'] = dto.status;
    if (dto.lostReason !== undefined) patch['lostReason'] = dto.lostReason;
    if (dto.assignedCaseManager !== undefined) {
      patch['assignedCaseManager'] = new Types.ObjectId(
        dto.assignedCaseManager,
      );
    }
    if (dto.actionTaken !== undefined) patch['actionTaken'] = dto.actionTaken;
    if (dto.actionDate !== undefined)
      patch['actionDate'] = new Date(dto.actionDate);
    if (dto.meetingLink !== undefined) patch['meetingLink'] = dto.meetingLink;
    if (dto.nextFollowUpAt !== undefined) {
      patch['nextFollowUpAt'] = new Date(dto.nextFollowUpAt);
    }
    if (dto.internalNote !== undefined)
      patch['internalNote'] = dto.internalNote;

    const lead = await this.leadModel
      .findByIdAndUpdate(leadId, patch, { returnDocument: 'after' })
      .populate('assignedCaseManager', 'name email')
      .exec();

    if (!lead) {
      throw new NotFoundException(`Lead #${leadId} not found`);
    }

    return lead;
  }

  async shareMeetingLink(
    leadId: string,
    meetingLink: string,
    actionTaken?: string,
  ): Promise<LeadDocument> {
    const lead = await this.leadModel.findById(leadId).exec();
    if (!lead) {
      throw new NotFoundException(`Lead #${leadId} not found`);
    }

    lead.meetingLink = meetingLink;
    lead.actionTaken = actionTaken ?? 'Meeting link shared';
    lead.actionDate = new Date();
    if (lead.status === LeadStatus.COLD) {
      lead.status = LeadStatus.WARM;
    }

    await this.emailService.sendMeetingLinkEmail(
      lead.email,
      lead.name,
      meetingLink,
      lead.actionTaken,
    );

    return lead.save();
  }

  /**
   * Creates a case for a lead, auto-provisioning a CLIENT account by email
   * if one doesn't already exist — leads aren't platform users, but
   * CasesService.create() requires a real clientId. The generated password
   * is unknown to the client; they set their own via "Forgot password" on
   * first sign-in (see initiateCase's email).
   */
  /**
   * A lead's caseId can go stale if its case was deleted before case removal
   * started clearing the back-reference (or by any other out-of-band delete).
   * Rather than trust the stored id, verify the case still exists — if not,
   * self-heal by clearing the dangling reference so the lead isn't stuck.
   */
  private async hasLiveCase(lead: LeadDocument): Promise<boolean> {
    if (!lead.caseId) return false;
    const stillExists = await this.casesService.exists(lead.caseId.toString());
    if (stillExists) return true;
    await this.leadModel
      .findByIdAndUpdate(lead._id, {
        $unset: { caseId: '', caseInitiatedAt: '' },
      })
      .exec();
    return false;
  }

  async createCaseFromLead(
    leadId: string,
    actorUserId: string,
  ): Promise<{ lead: LeadDocument; case: CaseDocument }> {
    const lead = await this.leadModel.findById(leadId).exec();
    if (!lead) {
      throw new NotFoundException(`Lead #${leadId} not found`);
    }
    if (await this.hasLiveCase(lead)) {
      throw new BadRequestException('This lead already has a case');
    }
    if (!lead.serviceType) {
      throw new BadRequestException(
        'Lead has no serviceType set — cannot create a case',
      );
    }

    let client = await this.usersService.findByEmail(lead.email);
    if (!client) {
      client = await this.usersService.create({
        email: lead.email,
        // Guaranteed to satisfy CreateUserDto's complexity regex regardless
        // of what the random suffix contains (base64url alone isn't — it
        // can land without a special character).
        password: `Aa1!${randomBytes(18).toString('base64url')}`,
        name: lead.name.trim(),
        role: Role.CLIENT,
      });
    }

    const displayService = lead.serviceType
      .replace(/_/g, ' ')
      .replace(/\b\w/g, (c) => c.toUpperCase());

    const caseDoc = await this.casesService.create(
      {
        clientId: (client._id as Types.ObjectId).toString(),
        serviceType: lead.serviceType,
        title: `${lead.name}, ${displayService}`,
        description: lead.message?.trim() || `${displayService} request converted from lead.`,
        leadId,
        propertyDetails: lead.preferredCity
          ? { city: lead.preferredCity }
          : undefined,
      },
      actorUserId,
    );

    const updatedLead = await this.convert(
      leadId,
      (caseDoc._id as Types.ObjectId).toString(),
    );

    return { lead: updatedLead, case: caseDoc };
  }

  async initiateCase(leadId: string): Promise<LeadDocument> {
    const lead = await this.leadModel
      .findById(leadId)
      .populate<{ caseId: CaseDocument }>('caseId')
      .exec();
    if (!lead) {
      throw new NotFoundException(`Lead #${leadId} not found`);
    }
    if (!lead.caseId) {
      throw new BadRequestException(
        'Create a case for this lead before initiating it',
      );
    }

    const caseDoc = lead.caseId as unknown as CaseDocument;
    await this.emailService.sendCaseInitiatedEmail(
      lead.email,
      lead.name,
      caseDoc.caseNumber,
      lead.serviceType,
    );

    lead.caseInitiatedAt = new Date();
    return lead.save();
  }

  async remove(leadId: string, requestingClientId?: string): Promise<void> {
    const lead = await this.leadModel.findById(leadId).exec();
    if (!lead) {
      throw new NotFoundException(`Lead #${leadId} not found`);
    }
    if (
      requestingClientId &&
      (!lead.clientId || lead.clientId.toString() !== requestingClientId)
    ) {
      throw new NotFoundException(`Lead #${leadId} not found`);
    }
    if (await this.hasLiveCase(lead)) {
      throw new BadRequestException(
        'Cannot delete a lead that already has a case',
      );
    }
    await this.leadModel.findByIdAndDelete(leadId).exec();
  }
}
