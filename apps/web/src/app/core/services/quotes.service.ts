import { Injectable } from '@angular/core';
import { map, Observable } from 'rxjs';
import { ApiService } from './api.service';

export interface Quote {
  _id: string;
  caseId: string;
  caseNumber?: string;
  vendorUserId: string;
  vendorName: string;
  serviceType: string;
  amountInPaise: number;
  currency: string;
  description: string;
  status: 'draft' | 'sent' | 'accepted' | 'rejected' | 'lost';
  sentAt?: string;
  respondedAt?: string;
  lostReason?: string;
  createdAt: string;
  updatedAt: string;
}

type ApiQuote = {
  _id: string;
  caseId: string | { _id: string; caseNumber?: string };
  vendorId?: string;
  serviceType?: string;
  totalAmount?: number;
  amountInPaise?: number;
  currency?: string;
  status: string;
  sentAt?: string;
  respondedAt?: string;
  rejectionReason?: string;
  createdAt: string;
  updatedAt: string;
  items?: Array<{ description: string }>;
};

export interface QuoteFilters extends Record<string, string | number | boolean | undefined> {
  caseId?: string;
  vendorUserId?: string;
  status?: string;
}

@Injectable({ providedIn: 'root' })
export class QuotesService {
  constructor(private api: ApiService) {}

  private toUiStatus(status: string): Quote['status'] {
    const normalized = status.toLowerCase();
    if (
      normalized === 'draft' ||
      normalized === 'sent' ||
      normalized === 'accepted' ||
      normalized === 'rejected' ||
      normalized === 'lost'
    ) {
      return normalized;
    }
    return 'draft';
  }

  private mapQuote(quote: ApiQuote): Quote {
    const amountInPaise =
      quote.amountInPaise ??
      (quote.totalAmount !== undefined ? Math.round(quote.totalAmount * 100) : 0);
    return {
      _id: quote._id,
      caseId: typeof quote.caseId === 'object' ? quote.caseId._id : String(quote.caseId),
      caseNumber: typeof quote.caseId === 'object' ? quote.caseId.caseNumber : undefined,
      vendorUserId: String(quote.vendorId ?? ''),
      vendorName: '',
      serviceType: quote.serviceType ?? quote.items?.[0]?.description ?? 'Service',
      amountInPaise,
      currency: quote.currency ?? 'INR',
      description: quote.items?.[0]?.description ?? '',
      status: this.toUiStatus(quote.status),
      sentAt: quote.sentAt,
      respondedAt: quote.respondedAt,
      lostReason: quote.rejectionReason,
      createdAt: quote.createdAt,
      updatedAt: quote.updatedAt,
    };
  }

  createQuote(dto: {
    caseId: string;
    vendorUserId: string;
    vendorName: string;
    serviceType: string;
    amountInPaise: number;
    description: string;
  }): Observable<Quote> {
    return this.api
      .post<ApiQuote>('/quotes', {
        caseId: dto.caseId,
        serviceType: dto.serviceType,
        amountInPaise: dto.amountInPaise,
        description: dto.description,
      })
      .pipe(map((quote) => this.mapQuote(quote)));
  }

  getQuotes(filters?: QuoteFilters): Observable<Quote[]> {
    return this.api
      .get<ApiQuote[]>('/quotes', filters)
      .pipe(map((quotes) => quotes.map((quote) => this.mapQuote(quote))));
  }

  getQuoteById(id: string): Observable<Quote> {
    return this.api.get<ApiQuote>(`/quotes/${id}`).pipe(map((quote) => this.mapQuote(quote)));
  }

  getQuotesByCase(caseId: string): Observable<Quote[]> {
    return this.api
      .get<ApiQuote[]>(`/quotes/case/${caseId}`)
      .pipe(map((quotes) => quotes.map((quote) => this.mapQuote(quote))));
  }

  getQuotesByClient(clientId: string): Observable<Quote[]> {
    return this.api
      .get<ApiQuote[]>(`/quotes/client/${clientId}`)
      .pipe(map((quotes) => quotes.map((quote) => this.mapQuote(quote))));
  }

  sendQuote(id: string): Observable<Quote> {
    return this.api
      .post<ApiQuote>(`/quotes/${id}/send`, {})
      .pipe(map((quote) => this.mapQuote(quote)));
  }

  respondQuote(id: string, accepted: boolean, comments?: string): Observable<Quote> {
    return this.api
      .post<ApiQuote>(`/quotes/${id}/respond`, {
        response: accepted ? 'ACCEPTED' : 'NEGOTIATING',
        comment: comments,
      })
      .pipe(map((quote) => this.mapQuote(quote)));
  }

  rejectQuote(id: string, reason?: string): Observable<Quote> {
    return this.api
      .post<ApiQuote>(`/quotes/${id}/reject`, { reason })
      .pipe(map((quote) => this.mapQuote(quote)));
  }

  deleteQuote(id: string): Observable<{ deleted: boolean }> {
    return this.api.delete<{ deleted: boolean }>(`/quotes/${id}`);
  }
}
