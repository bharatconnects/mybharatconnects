import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import { randomUUID } from 'crypto';
import { CaseEvents, CaseEventPayload } from '../../common/events/case-events';
import {
  Document,
  DocumentDocument,
  VerificationStatus,
} from './schemas/document.schema';
import { Case, CaseDocument } from '../cases/schemas/case.schema';
import { Vendor, VendorDocument } from '../vendors/schemas/vendor.schema';
import { Role } from '../../common/enums/roles.enum';
import { S3Service } from './documents.s3.service';
import { RequestUploadDto } from './dto/request-upload.dto';

export interface UploadRequestResult {
  documentId: string;
  uploadUrl: string;
  s3Key: string;
}

// Case documents are meant for records/evidence (agreements, IDs, invoices,
// receipts) — not arbitrary file types. Kept in sync with the frontend's
// own `accept` attribute on the upload input; this is the check that
// actually matters since the client-side one is trivially bypassable.
const ALLOWED_DOCUMENT_MIME_TYPES = new Set([
  'application/pdf',
  'application/msword',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  'application/vnd.ms-excel',
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
]);

function isAllowedDocumentMimeType(mimeType: string): boolean {
  // image/svg+xml is deliberately excluded even though it matches the
  // image/* prefix — SVGs can embed <script>/event handlers, and downloads
  // aren't forced (no Content-Disposition: attachment override), so an
  // uploaded SVG opened directly in a browser tab would execute as a
  // stored-XSS payload. Every other image/* type is inert raster/vector
  // data with no script capability.
  return (
    (mimeType.startsWith('image/') && mimeType !== 'image/svg+xml') ||
    ALLOWED_DOCUMENT_MIME_TYPES.has(mimeType)
  );
}

// Enforced two ways: rejected here before a presigned URL is even issued,
// and baked into the presigned URL itself (S3Service signs ContentLength),
// so a client can't bypass this by just lying about sizeBytes and uploading
// more than it declared.
const MAX_UPLOAD_BYTES = 5 * 1024 * 1024;

export interface DocumentActor {
  userId: string;
  role: string;
}

@Injectable()
export class DocumentsService {
  constructor(
    @InjectModel(Document.name)
    private readonly documentModel: Model<DocumentDocument>,
    @InjectModel(Case.name) private readonly caseModel: Model<CaseDocument>,
    @InjectModel(Vendor.name) private readonly vendorModel: Model<VendorDocument>,
    private readonly s3Service: S3Service,
    private readonly events: EventEmitter2,
  ) {}

  /** CASE_MANAGER/QA/ADMIN see everything; CLIENT/VENDOR only see docs
   * toggled visible to them, and only for a case they're actually on. */
  private async assertCanAccessDocument(
    doc: DocumentDocument,
    actor: DocumentActor,
  ): Promise<void> {
    if (
      actor.role === Role.CASE_MANAGER ||
      actor.role === Role.QA ||
      actor.role === Role.ADMIN
    ) {
      return;
    }

    if (actor.role === Role.CLIENT) {
      if (!doc.clientVisible) {
        throw new ForbiddenException('This document has not been shared with you');
      }
      const caseDoc = await this.caseModel
        .findById(doc.caseId)
        .select('clientId')
        .exec();
      if (!caseDoc || caseDoc.clientId.toString() !== actor.userId) {
        throw new ForbiddenException('Not authorized to access this document');
      }
      return;
    }

    if (actor.role === Role.VENDOR) {
      if (!doc.vendorVisible) {
        throw new ForbiddenException('This document has not been shared with you');
      }
      const vendor = await this.vendorModel
        .findOne({ userId: new Types.ObjectId(actor.userId) })
        .select('_id')
        .exec();
      const caseDoc = await this.caseModel
        .findById(doc.caseId)
        .select('vendorId')
        .exec();
      if (
        !vendor ||
        !caseDoc?.vendorId ||
        caseDoc.vendorId.toString() !== vendor._id.toString()
      ) {
        throw new ForbiddenException('Not authorized to access this document');
      }
      return;
    }

    throw new ForbiddenException('Not authorized to access this document');
  }

  /** Same actor-to-case scoping as assertCanAccessDocument, but for actions
   * (like starting an upload) that don't have a Document to check yet —
   * only that the actor is actually on this case at all. */
  private async assertActorOnCase(caseId: string, actor: DocumentActor): Promise<void> {
    if (
      actor.role === Role.CASE_MANAGER ||
      actor.role === Role.QA ||
      actor.role === Role.ADMIN
    ) {
      return;
    }

    const caseDoc = await this.caseModel
      .findById(caseId)
      .select('clientId vendorId')
      .exec();
    if (!caseDoc) {
      throw new NotFoundException(`Case ${caseId} not found`);
    }

    if (actor.role === Role.CLIENT) {
      if (caseDoc.clientId.toString() !== actor.userId) {
        throw new ForbiddenException('Not authorized for this case');
      }
      return;
    }

    if (actor.role === Role.VENDOR) {
      const vendor = await this.vendorModel
        .findOne({ userId: new Types.ObjectId(actor.userId) })
        .select('_id')
        .exec();
      if (!vendor || caseDoc.vendorId?.toString() !== vendor._id.toString()) {
        throw new ForbiddenException('Not authorized for this case');
      }
      return;
    }

    throw new ForbiddenException('Not authorized for this case');
  }

  async setVisibility(
    documentIds: string[],
    updates: { clientVisible?: boolean; vendorVisible?: boolean },
    actorUserId: string,
  ): Promise<{ modifiedCount: number }> {
    const set: Record<string, unknown> = {
      visibilityUpdatedAt: new Date(),
      visibilityUpdatedBy: new Types.ObjectId(actorUserId),
    };
    if (typeof updates.clientVisible === 'boolean') {
      set.clientVisible = updates.clientVisible;
    }
    if (typeof updates.vendorVisible === 'boolean') {
      set.vendorVisible = updates.vendorVisible;
    }

    const result = await this.documentModel
      .updateMany(
        { _id: { $in: documentIds.map((id) => new Types.ObjectId(id)) } },
        { $set: set },
      )
      .exec();

    return { modifiedCount: result.modifiedCount };
  }

  async requestUploadUrl(
    dto: RequestUploadDto,
    actor: DocumentActor,
  ): Promise<UploadRequestResult> {
    if (!isAllowedDocumentMimeType(dto.mimeType)) {
      throw new BadRequestException(
        'Only PDF, Word, Excel, or image files can be uploaded as case documents.',
      );
    }

    if (dto.sizeBytes > MAX_UPLOAD_BYTES) {
      throw new BadRequestException('File must be 5 MB or smaller.');
    }

    await this.assertActorOnCase(dto.caseId, actor);

    // The name comes from the file itself now (see RequestUploadDto) —
    // duplicate names on the same case are confusing (which "Signed
    // Agreement.pdf" is current?), so reject rather than silently
    // shadowing an existing document.
    const duplicate = await this.documentModel
      .exists({ caseId: new Types.ObjectId(dto.caseId), name: dto.name })
      .exec();
    if (duplicate) {
      throw new ConflictException(
        `A document named "${dto.name}" already exists on this case — rename the file and try again.`,
      );
    }

    const s3Key = `cases/${dto.caseId}/${randomUUID()}-${dto.originalFileName}`;

    const uploadUrl = await this.s3Service.getPresignedUploadUrl(
      s3Key,
      dto.mimeType,
      dto.sizeBytes,
    );

    // A document is always visible to whoever just uploaded it — there's no
    // toggle for that side in the CM UI, so it must default true at creation
    // rather than rely on the (false-by-default) visibility flags.
    const doc = new this.documentModel({
      caseId: new Types.ObjectId(dto.caseId),
      uploadedBy: new Types.ObjectId(actor.userId),
      category: dto.category,
      name: dto.name,
      originalFileName: dto.originalFileName,
      s3Key,
      s3Bucket: this.s3Service.getBucket(),
      mimeType: dto.mimeType,
      sizeBytes: dto.sizeBytes,
      clientVisible: actor.role === Role.CLIENT,
      vendorVisible: actor.role === Role.VENDOR,
    });

    const saved = await doc.save();

    return {
      documentId: String(saved._id),
      uploadUrl,
      s3Key,
    };
  }

  async confirmUpload(documentId: string): Promise<DocumentDocument> {
    const updated = await this.documentModel
      .findByIdAndUpdate(
        documentId,
        { $set: { uploadedAt: new Date() } },
        { returnDocument: 'after' },
      )
      .exec();

    if (!updated) {
      throw new NotFoundException(`Document ${documentId} not found`);
    }

    return updated;
  }

  async getDownloadUrl(
    documentId: string,
    actor: DocumentActor,
  ): Promise<{ downloadUrl: string }> {
    const doc = await this.documentModel.findById(documentId).exec();
    if (!doc) {
      throw new NotFoundException(`Document ${documentId} not found`);
    }

    await this.assertCanAccessDocument(doc, actor);

    const downloadUrl = await this.s3Service.getPresignedDownloadUrl(doc.s3Key);
    return { downloadUrl };
  }

  async findByCase(
    caseId: string,
    actor: DocumentActor,
  ): Promise<DocumentDocument[]> {
    const query: Record<string, unknown> = { caseId: new Types.ObjectId(caseId) };

    if (actor.role === Role.CLIENT) {
      const caseDoc = await this.caseModel
        .findById(caseId)
        .select('clientId')
        .exec();
      if (!caseDoc || caseDoc.clientId.toString() !== actor.userId) {
        throw new ForbiddenException('Not authorized to view documents for this case');
      }
      query.clientVisible = true;
    } else if (actor.role === Role.VENDOR) {
      const vendor = await this.vendorModel
        .findOne({ userId: new Types.ObjectId(actor.userId) })
        .select('_id')
        .exec();
      const caseDoc = await this.caseModel
        .findById(caseId)
        .select('vendorId')
        .exec();
      if (
        !vendor ||
        !caseDoc?.vendorId ||
        caseDoc.vendorId.toString() !== vendor._id.toString()
      ) {
        throw new ForbiddenException('Not authorized to view documents for this case');
      }
      query.vendorVisible = true;
    }
    // CASE_MANAGER, QA, ADMIN: unrestricted

    return this.documentModel
      .find(query)
      .sort({ createdAt: -1 })
      .exec();
  }

  async findAll(filters: {
    caseId?: string;
    clientId?: string;
    status?: string;
  }): Promise<DocumentDocument[]> {
    const query: Record<string, unknown> = {};

    if (filters.caseId) {
      query.caseId = new Types.ObjectId(filters.caseId);
    }

    if (filters.clientId) {
      const cases = await this.caseModel
        .find({ clientId: new Types.ObjectId(filters.clientId) })
        .select('_id')
        .exec();
      query.caseId = { $in: cases.map((c) => c._id) };
    }

    if (filters.status) {
      const status = filters.status.toLowerCase();
      if (status === 'pending') {
        query.verificationStatus = VerificationStatus.PENDING;
      } else if (status === 'verified') {
        query.verificationStatus = VerificationStatus.VERIFIED;
      } else if (status === 'rejected') {
        query.verificationStatus = VerificationStatus.REJECTED_ILLEGIBLE;
      }
    }

    return this.documentModel
      .find(query)
      .populate('caseId', 'caseNumber')
      .populate('uploadedBy', 'name email role')
      .sort({ createdAt: -1 })
      .exec();
  }

  async findByClient(clientId: string): Promise<DocumentDocument[]> {
    const cases = await this.caseModel
      .find({ clientId: new Types.ObjectId(clientId) })
      .select('_id')
      .exec();
    const caseIds = cases.map((c) => c._id);
    if (caseIds.length === 0) return [];
    return this.documentModel
      .find({ caseId: { $in: caseIds } })
      .sort({ createdAt: -1 })
      .exec();
  }

  async verify(
    documentId: string,
    verifiedByUserId: string,
  ): Promise<DocumentDocument> {
    const updated = await this.documentModel
      .findByIdAndUpdate(
        documentId,
        {
          $set: {
            isVerified: true,
            verificationStatus: VerificationStatus.VERIFIED,
            verifiedBy: new Types.ObjectId(verifiedByUserId),
            verifiedAt: new Date(),
          },
        },
        { returnDocument: 'after' },
      )
      .exec();

    if (!updated) {
      throw new NotFoundException(`Document ${documentId} not found`);
    }

    const payload: CaseEventPayload = {
      caseId: updated.caseId.toString(),
      actorUserId: verifiedByUserId,
      metadata: { documentId },
    };
    this.events.emit(CaseEvents.DOCUMENTS_VERIFIED, payload);

    return updated;
  }

  async reject(
    documentId: string,
    actorUserId: string,
    reason: string,
  ): Promise<DocumentDocument> {
    const updated = await this.documentModel
      .findByIdAndUpdate(
        documentId,
        {
          $set: {
            isVerified: false,
            verificationStatus: VerificationStatus.REJECTED_ILLEGIBLE,
            verifiedBy: new Types.ObjectId(actorUserId),
            verifiedAt: new Date(),
            cmAnnotation: reason,
          },
        },
        { returnDocument: 'after' },
      )
      .exec();

    if (!updated) {
      throw new NotFoundException(`Document ${documentId} not found`);
    }

    return updated;
  }

  async delete(
    documentId: string,
    actor: DocumentActor,
  ): Promise<{ success: boolean }> {
    const doc = await this.documentModel.findById(documentId).exec();
    if (!doc) {
      throw new NotFoundException(`Document ${documentId} not found`);
    }

    const isUploader = String(doc.uploadedBy) === actor.userId;
    const isCaseStaff =
      actor.role === Role.CASE_MANAGER ||
      actor.role === Role.ADMIN ||
      actor.role === Role.QA;
    if (!isUploader && !isCaseStaff) {
      throw new ForbiddenException(
        'Only the uploader or case staff may delete this document',
      );
    }

    await this.s3Service.deleteObject(doc.s3Key);
    await this.documentModel.findByIdAndDelete(documentId).exec();

    return { success: true };
  }

  async findById(id: string, actor: DocumentActor): Promise<DocumentDocument> {
    const doc = await this.documentModel.findById(id).exec();
    if (!doc) {
      throw new NotFoundException(`Document ${id} not found`);
    }
    await this.assertCanAccessDocument(doc, actor);
    return doc;
  }

  async addComment(
    documentId: string,
    actorUserId: string,
    input: { text: string; page?: number; x?: number; y?: number },
  ): Promise<unknown> {
    const comment = {
      author: new Types.ObjectId(actorUserId),
      text: input.text,
      page: input.page,
      x: input.x,
      y: input.y,
      createdAt: new Date(),
    };

    const updated = await this.documentModel
      .findByIdAndUpdate(
        documentId,
        { $push: { comments: comment } },
        { returnDocument: 'after' },
      )
      .populate('comments.author', 'name email role')
      .exec();

    if (!updated) {
      throw new NotFoundException(`Document ${documentId} not found`);
    }

    return updated.comments[updated.comments.length - 1];
  }

  async setAnnotation(
    documentId: string,
    annotation: string,
  ): Promise<DocumentDocument> {
    const updated = await this.documentModel
      .findByIdAndUpdate(
        documentId,
        { $set: { cmAnnotation: annotation } },
        { returnDocument: 'after' },
      )
      .exec();

    if (!updated) {
      throw new NotFoundException(`Document ${documentId} not found`);
    }

    return updated;
  }
}
