import { Injectable } from '@angular/core';
import { map, Observable } from 'rxjs';
import { ApiService } from './api.service';

export interface Document {
  _id: string;
  caseId: string;
  caseNumber?: string;
  clientId: string;
  fileName: string;
  fileType: string;
  s3Url: string;
  fileSize: number;
  uploadedBy: string;
  uploaderName?: string;
  uploadedAt: string;
  verifiedAt?: string;
  verifiedBy?: string;
  status: 'pending' | 'verified' | 'rejected';
  rejectionReason?: string;
  comments?: string[];
  createdAt: string;
  updatedAt: string;
}

type ApiDocument = {
  _id: string;
  caseId: string | { _id: string; caseNumber?: string };
  uploadedBy: string | { _id: string; name?: string; email?: string };
  name: string;
  originalFileName: string;
  mimeType: string;
  sizeBytes: number;
  isVerified?: boolean;
  verificationStatus?: string;
  cmAnnotation?: string;
  createdAt: string;
  uploadedAt?: string;
  verifiedAt?: string;
  verifiedBy?: string;
  updatedAt: string;
};

export interface DocumentFilters extends Record<string, string | number | boolean | undefined> {
  caseId?: string;
  clientId?: string;
  status?: string;
}

@Injectable({ providedIn: 'root' })
export class DocumentsService {
  constructor(private api: ApiService) {}

  private mapStatus(doc: ApiDocument): Document['status'] {
    if (doc.isVerified || (doc.verificationStatus ?? '').toUpperCase() === 'VERIFIED') {
      return 'verified';
    }
    if ((doc.verificationStatus ?? '').toUpperCase() === 'REJECTED_ILLEGIBLE') {
      return 'rejected';
    }
    return 'pending';
  }

  private mapDocument(doc: ApiDocument): Document {
    const caseIdStr = typeof doc.caseId === 'object' ? doc.caseId._id : String(doc.caseId);
    const caseNumber = typeof doc.caseId === 'object' ? doc.caseId.caseNumber : undefined;
    const uploadedByStr =
      typeof doc.uploadedBy === 'object' ? doc.uploadedBy._id : String(doc.uploadedBy);
    const uploaderName =
      typeof doc.uploadedBy === 'object'
        ? doc.uploadedBy.name ||
          doc.uploadedBy.email ||
          undefined
        : undefined;
    return {
      _id: doc._id,
      caseId: caseIdStr,
      caseNumber,
      clientId: '',
      fileName: doc.originalFileName ?? doc.name,
      fileType: doc.mimeType,
      s3Url: '',
      fileSize: doc.sizeBytes,
      uploadedBy: uploadedByStr,
      uploaderName,
      uploadedAt: doc.uploadedAt ?? doc.createdAt,
      verifiedAt: doc.verifiedAt,
      verifiedBy: doc.verifiedBy,
      status: this.mapStatus(doc),
      rejectionReason: doc.cmAnnotation,
      comments: [],
      createdAt: doc.createdAt,
      updatedAt: doc.updatedAt,
    };
  }

  requestUploadUrl(dto: {
    caseId: string;
    category: 'IDENTITY' | 'PROPERTY' | 'FINANCIAL' | 'LEGAL' | 'AGREEMENT' | 'OTHER';
    name: string;
    originalFileName: string;
    mimeType: string;
    sizeBytes: number;
  }): Observable<{ uploadUrl: string; documentId: string }> {
    return this.api.post<{ uploadUrl: string; documentId: string }>(
      '/documents/upload-request',
      dto,
    );
  }

  confirmUpload(documentId: string): Observable<Document> {
    return this.api
      .post<ApiDocument>(`/documents/${documentId}/confirm`, {})
      .pipe(map((doc) => this.mapDocument(doc)));
  }

  getDocuments(filters?: DocumentFilters): Observable<Document[]> {
    return this.api
      .get<ApiDocument[]>('/documents', filters)
      .pipe(map((docs) => docs.map((doc) => this.mapDocument(doc))));
  }

  getDocumentById(id: string): Observable<Document> {
    return this.api.get<ApiDocument>(`/documents/${id}`).pipe(map((doc) => this.mapDocument(doc)));
  }

  getDocumentsByCase(caseId: string): Observable<Document[]> {
    return this.api
      .get<ApiDocument[]>(`/documents/case/${caseId}`)
      .pipe(map((docs) => docs.map((doc) => this.mapDocument(doc))));
  }

  getDocumentsByClient(_clientId: string): Observable<Document[]> {
    return this.api
      .get<ApiDocument[]>(`/documents/mine`)
      .pipe(map((docs) => docs.map((doc) => this.mapDocument(doc))));
  }

  verifyDocument(id: string): Observable<Document> {
    return this.api
      .patch<ApiDocument>(`/documents/${id}/verify`, {})
      .pipe(map((doc) => this.mapDocument(doc)));
  }

  rejectDocument(id: string, reason: string): Observable<Document> {
    return this.api
      .patch<ApiDocument>(`/documents/${id}/reject`, { reason })
      .pipe(map((doc) => this.mapDocument(doc)));
  }

  addComment(id: string, text: string): Observable<Document> {
    return this.api.post<Document>(`/documents/${id}/comments`, { text });
  }

  getDownloadUrl(id: string): Observable<{ downloadUrl: string }> {
    return this.api.get<{ downloadUrl: string }>(`/documents/${id}/download`);
  }

  deleteDocument(id: string): Observable<{ message: string }> {
    return this.api
      .delete<{ success: boolean }>(`/documents/${id}`)
      .pipe(map(() => ({ message: 'Document deleted' })));
  }
}
