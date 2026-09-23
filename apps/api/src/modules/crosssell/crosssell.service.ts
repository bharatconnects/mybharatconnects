import { Injectable, NotFoundException, Logger } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import {
  CrosssellRule,
  CrosssellRuleDocument,
} from './schemas/crosssell-rule.schema';
import {
  CrosssellTrigger,
  CrosssellTriggerDocument,
} from './schemas/crosssell-trigger.schema';
import { NotificationsService } from '../notifications/notifications.service';

interface PdfRule {
  trigger: string;
  nextService: string;
  alternativeService?: string;
  delayDays: number;
  description: string;
}

const PDF_RULES: PdfRule[] = [
  {
    trigger: 'POA_REGISTERED',
    nextService: 'PROPERTY_MANAGEMENT',
    alternativeService: 'FORM_13',
    delayDays: 7,
    description:
      'POA registration → suggest Property Management or Form 13 after 7 days',
  },
  {
    trigger: 'PROPERTY_MGMT_ONBOARDED',
    nextService: 'INDIAN_ITR_FILING',
    delayDays: -1,
    description:
      'Property Management onboarded → suggest Indian ITR Filing in next March',
  },
  {
    trigger: 'ITR_FILED',
    nextService: 'US_TAX_FILING',
    alternativeService: 'NOTICE_RESPONSE',
    delayDays: 14,
    description:
      'Indian ITR filed → suggest US Tax Filing or Notice Response after 14 days',
  },
  {
    trigger: 'FORM_13_ISSUED',
    nextService: '15CA_15CB_BUNDLE',
    delayDays: 3,
    description:
      'Form 13 issued → suggest 15CA/15CB Repatriation Bundle after 3 days',
  },
  {
    trigger: 'PROPERTY_SALE_COMPLETED',
    nextService: 'CAPITAL_GAINS_ADVISORY',
    alternativeService: '54EC_BONDS',
    delayDays: 1,
    description:
      'Property sale → suggest Capital Gains advisory + 54EC bonds next day',
  },
  {
    trigger: 'BUYING_COMPLETE',
    nextService: 'PROPERTY_INSURANCE',
    alternativeService: 'PROPERTY_MANAGEMENT',
    delayDays: 7,
    description:
      'Buying assistance complete → suggest Property Insurance + Property Management after 7 days',
  },
  {
    trigger: 'TAX_CLIENT_PARENTS_IN_INDIA',
    nextService: 'ELDER_CARE_SUBSCRIPTION',
    delayDays: 0,
    description:
      'Tax client with parents in India → soft prompt for Elder Care subscription',
  },
];

@Injectable()
export class CrosssellService {
  private readonly logger = new Logger(CrosssellService.name);

  constructor(
    @InjectModel(CrosssellRule.name)
    private readonly ruleModel: Model<CrosssellRuleDocument>,
    @InjectModel(CrosssellTrigger.name)
    private readonly triggerModel: Model<CrosssellTriggerDocument>,
    private readonly notificationsService: NotificationsService,
  ) {}

  async seedDefaultRules(): Promise<{ seeded: number; rules: string[] }> {
    for (const rule of PDF_RULES) {
      await this.ruleModel.findOneAndUpdate(
        { trigger: rule.trigger },
        {
          $set: {
            trigger: rule.trigger,
            nextService: rule.nextService,
            alternativeService: rule.alternativeService,
            delayDays: rule.delayDays,
            description: rule.description,
            isActive: true,
          },
        },
        { upsert: true, returnDocument: 'after', setDefaultsOnInsert: true },
      );
    }

    const rules = PDF_RULES.map((r) => r.trigger);
    this.logger.log(`CrossSell rules seeded: ${rules.length} upserted`);
    return { seeded: rules.length, rules };
  }

  async evaluateTriggers(
    caseId: string,
    newStatus: string,
    serviceType: string,
    clientId: string,
    caseManagerId: string,
  ): Promise<CrosssellTriggerDocument[]> {
    const triggerEvent = newStatus === 'CLOSED' ? 'CASE_CLOSED' : newStatus;

    const matchingRules = await this.ruleModel
      .find({
        triggerEvent,
        sourceServiceType: serviceType,
        isActive: true,
      })
      .sort({ priority: 1 })
      .exec();

    const triggers: CrosssellTriggerDocument[] = [];

    for (const rule of matchingRules) {
      const scheduledAt = new Date();
      scheduledAt.setDate(scheduledAt.getDate() + rule.delayDays);

      const trigger = await this.triggerModel.create({
        clientId,
        caseId,
        ruleId: rule._id,
        status: 'PENDING',
        scheduledAt,
        caseManagerId,
      });

      triggers.push(trigger);
    }

    this.logger.log(
      `CrossSell: ${triggers.length} trigger(s) created for case ${caseId}`,
    );
    return triggers;
  }

  async processPendingTriggers(): Promise<void> {
    const now = new Date();
    const pendingTriggers = await this.triggerModel
      .find({ status: 'PENDING', scheduledAt: { $lte: now } })
      .populate<{ ruleId: CrosssellRuleDocument }>('ruleId')
      .exec();

    for (const trigger of pendingTriggers) {
      try {
        const rule = trigger.ruleId as CrosssellRuleDocument;
        const title = 'New Service Recommendation';
        const body = `We recommend our ${rule.suggestedServiceType} service for you. Check it out!`;

        await this.notificationsService.createInApp(
          trigger.clientId.toString(),
          title,
          body,
          'CROSSSELL',
          {
            triggerId: trigger._id?.toString() ?? '',
            suggestedServiceType: rule.suggestedServiceType,
            caseId: trigger.caseId.toString(),
          },
        );

        trigger.status = 'SENT';
        trigger.sentAt = new Date();
        await trigger.save();

        this.logger.log(`CrossSell trigger ${trigger._id?.toString()} sent`);
      } catch (err) {
        this.logger.error(
          `Failed to process crosssell trigger ${trigger._id?.toString()}`,
          err,
        );
      }
    }
  }

  async dismiss(triggerId: string, userId: string): Promise<CrosssellTriggerDocument> {
    const trigger = await this.triggerModel.findById(triggerId);
    if (!trigger) {
      throw new NotFoundException(`CrossSell trigger ${triggerId} not found`);
    }

    // Verify the user is the case manager or client
    const isAssociated =
      trigger.caseManagerId.toString() === userId ||
      trigger.clientId.toString() === userId;

    if (!isAssociated) {
      throw new NotFoundException(`CrossSell trigger ${triggerId} not found`);
    }

    trigger.status = 'DISMISSED';
    return trigger.save();
  }

  async convert(
    triggerId: string,
    newCaseId: string,
  ): Promise<CrosssellTriggerDocument> {
    const trigger = await this.triggerModel.findById(triggerId);
    if (!trigger) {
      throw new NotFoundException(`CrossSell trigger ${triggerId} not found`);
    }

    trigger.status = 'CONVERTED';
    trigger.convertedCaseId = newCaseId as unknown as CrosssellTrigger['convertedCaseId'];
    return trigger.save();
  }

  async getPendingForCaseManager(
    cmId: string,
  ): Promise<CrosssellTriggerDocument[]> {
    return this.triggerModel
      .find({ caseManagerId: cmId, status: 'SENT' })
      .populate('ruleId')
      .populate('clientId', 'name email')
      .populate('caseId', 'caseNumber title')
      .sort({ scheduledAt: 1 })
      .exec();
  }

  async findAll(): Promise<CrosssellTriggerDocument[]> {
    return this.triggerModel
      .find()
      .populate('ruleId')
      .populate('clientId', 'name email')
      .populate('caseId', 'caseNumber title')
      .sort({ createdAt: -1 })
      .exec();
  }

  async getRules(): Promise<CrosssellRuleDocument[]> {
    return this.ruleModel.find().sort({ priority: 1 }).exec();
  }
}
