import { Injectable } from '@angular/core';
import { Observable } from 'rxjs';
import { map } from 'rxjs/operators';
import { ApiService } from '../../../core/services/api.service';
import { AuthService } from '../../../core/auth/auth.service';
import { Case, Document, DashboardData } from '../models/case.model';

export interface RequestServiceDto {
  name: string;
  email: string;
  phone?: string;
  service: string;
  country?: string;
  timezone?: string;
  intentTag?: string;
  notes?: string;
}

export interface ServiceRequest {
  _id: string;
  name: string;
  email: string;
  phone?: string;
  country?: string;
  timezone?: string;
  intentTag?: string;
  serviceType?: string;
  message?: string;
  status: 'COLD' | 'WARM' | 'HOT' | 'CANCELLED' | string;
  caseId?: { _id: string; caseNumber: string } | string;
  createdAt: string;
}

export interface PlatformRatingDto {
  starRating: number;
  comment?: string;
}

export interface ConsultantRatingDto {
  rating: number;
  communication: number;
  expertise: number;
  responsiveness: number;
  comment?: string;
  caseId?: string;
}

export interface ComplaintDto {
  category: string;
  subject: string;
  description: string;
  caseId?: string;
}

interface ClientDashboardApiResponse {
  activeCases?: number | Array<{ id: string; title: string; status: string }>;
  pendingDocuments?: number;
  pendingPayments?: number;
  pendingRents?: number;
  recentCases?: Case[];
}

@Injectable({ providedIn: 'root' })
export class ClientCasesService {
  constructor(
    private api: ApiService,
    private authService: AuthService,
  ) {}

  // ─── Cases ───────────────────────────────────────────
  getCases(): Observable<Case[]> {
    return this.api.get<Case[]>('/cases/mine');
  }

  getCaseById(id: string): Observable<Case> {
    return this.api.get<Case>(`/cases/${id}`);
  }

  // ─── Documents ───────────────────────────────────────
  getDocuments(): Observable<Document[]> {
    return this.api.get<Document[]>('/documents/mine');
  }

  downloadDocument(id: string): Observable<{ downloadUrl: string }> {
    return this.api.get<{ downloadUrl: string }>(`/documents/${id}/download`);
  }

  // ─── Dashboard ───────────────────────────────────────
  getDashboard(): Observable<DashboardData> {
    return this.api.get<ClientDashboardApiResponse>('/dashboard/client').pipe(
      map((res) => ({
        activeCases: Array.isArray(res.activeCases)
          ? res.activeCases.length
          : (res.activeCases ?? 0),
        pendingDocuments: res.pendingDocuments ?? 0,
        pendingPayments: res.pendingPayments ?? 0,
        pendingRents: res.pendingRents ?? 0,
        recentCases: res.recentCases ?? [],
      })),
    );
  }

  // ─── Lead capture (Request a New Service) ────────────
  // /leads/mine is CLIENT-only and attaches the request to the caller's
  // account so it shows up in getMyRequests() below.
  requestService(dto: RequestServiceDto): Observable<unknown> {
    return this.api.post<unknown>('/leads/mine', dto);
  }

  getMyRequests(): Observable<ServiceRequest[]> {
    return this.api.get<ServiceRequest[]>('/leads/mine');
  }

  // Caller (ClientRequestServiceComponent) already renames service/notes to
  // the backend's serviceType/message before calling this, same as
  // requestService() above — kept as a thin pass-through for consistency.
  updateRequest(id: string, payload: unknown): Observable<ServiceRequest> {
    return this.api.patch<ServiceRequest>(`/leads/${id}/mine`, payload);
  }

  cancelRequest(id: string): Observable<ServiceRequest> {
    return this.api.patch<ServiceRequest>(`/leads/${id}/cancel`, {});
  }

  deleteRequest(id: string): Observable<unknown> {
    return this.api.delete<unknown>(`/leads/${id}`);
  }

  // ─── Feedback ────────────────────────────────────────
  submitPlatformRating(dto: PlatformRatingDto): Observable<{ _id: string }> {
    return this.api.post<{ _id: string }>('/feedback/ratings/platform', dto);
  }

  submitConsultantRating(consultantId: string, dto: ConsultantRatingDto): Observable<unknown> {
    return this.api.post<unknown>(`/feedback/ratings/consultant/${consultantId}`, dto);
  }

  submitComplaint(dto: ComplaintDto): Observable<unknown> {
    return this.api.post<unknown>('/feedback/complaints', dto);
  }
}
