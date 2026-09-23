import { Injectable } from '@angular/core';
import { map, Observable } from 'rxjs';
import { ApiService } from './api.service';

export interface PaymentIntent {
  paymentIntentId: string;
  clientSecret: string;
}

export type PaymentPurpose = 'TOKEN' | 'PARTIAL' | 'MILESTONE' | 'FULL';
export type PaymentDirection = 'CLIENT_TO_CM' | 'CM_TO_VENDOR';

export interface Payment {
  _id: string;
  caseId: string;
  caseNumber?: string;
  clientId: string;
  clientName?: string;
  direction: PaymentDirection;
  vendorId?: string;
  vendorName?: string;
  amountInPaise: number;
  currency: string;
  status: 'pending' | 'authorized' | 'captured' | 'failed' | 'refunded';
  description: string;
  transactionId?: string;
  purpose?: PaymentPurpose;
  milestoneId?: string;
  receiptDocumentId?: string;
  receiptUrl?: string;
  requestedAt?: string;
  createdAt: string;
  updatedAt: string;
}

type ApiPayment = {
  _id: string;
  caseId: string | { _id: string; caseNumber?: string } | null;
  clientId: string | { _id: string; name?: string; email?: string } | null;
  direction?: PaymentDirection;
  vendorId?: string | { _id: string; businessName?: string } | null;
  amount?: number;
  amountInPaise?: number;
  currency?: string;
  status: string;
  description?: string;
  stripePaymentIntentId?: string;
  purpose?: PaymentPurpose;
  milestoneId?: string;
  receiptDocumentId?: string;
  receiptUrl?: string;
  requestedAt?: string;
  createdAt: string;
  updatedAt: string;
};

export interface RequestPaymentPayload {
  caseId: string;
  clientId: string;
  amountInPaise: number;
  purpose: PaymentPurpose;
  description: string;
  quoteId?: string;
  milestoneId?: string;
}

export interface RequestVendorPaymentPayload {
  caseId: string;
  amountInPaise: number;
  description: string;
  milestoneId?: string;
}

export interface PaymentFilters extends Record<string, string | number | boolean | undefined> {
  caseId?: string;
  clientId?: string;
  status?: string;
}

@Injectable({ providedIn: 'root' })
export class PaymentsService {
  constructor(private api: ApiService) {}

  private toUiStatus(status: string): Payment['status'] {
    const normalized = status.toLowerCase();
    if (
      normalized === 'pending' ||
      normalized === 'authorized' ||
      normalized === 'captured' ||
      normalized === 'failed' ||
      normalized === 'refunded'
    ) {
      return normalized;
    }
    return 'pending';
  }

  private mapPayment(payment: ApiPayment): Payment {
    const amountInPaise = payment.amountInPaise ?? payment.amount ?? 0;
    // `typeof null === 'object'` — a populated ref, an un-populated id string,
    // and a genuinely absent (null) ref all have to be told apart here.
    const caseIdStr =
      payment.caseId && typeof payment.caseId === 'object'
        ? payment.caseId._id
        : (payment.caseId ?? '');
    const caseNumber =
      payment.caseId && typeof payment.caseId === 'object' ? payment.caseId.caseNumber : undefined;
    const clientIdStr =
      payment.clientId && typeof payment.clientId === 'object'
        ? payment.clientId._id
        : (payment.clientId ?? '');
    const clientName =
      payment.clientId && typeof payment.clientId === 'object'
        ? payment.clientId.name ||
          payment.clientId.email
        : undefined;
    const vendorIdStr =
      payment.vendorId && typeof payment.vendorId === 'object'
        ? payment.vendorId._id
        : (payment.vendorId ?? undefined);
    const vendorName =
      payment.vendorId && typeof payment.vendorId === 'object'
        ? payment.vendorId.businessName
        : undefined;
    return {
      _id: payment._id,
      caseId: caseIdStr,
      caseNumber,
      clientId: clientIdStr,
      clientName,
      direction: payment.direction ?? 'CLIENT_TO_CM',
      vendorId: vendorIdStr,
      vendorName,
      amountInPaise,
      currency: payment.currency ?? 'usd',
      status: this.toUiStatus(payment.status),
      description: payment.description ?? '',
      transactionId: payment.stripePaymentIntentId,
      purpose: payment.purpose,
      milestoneId: payment.milestoneId,
      receiptDocumentId: payment.receiptDocumentId,
      receiptUrl: payment.receiptUrl,
      requestedAt: payment.requestedAt,
      createdAt: payment.createdAt,
      updatedAt: payment.updatedAt,
    };
  }

  createAuthHold(
    caseId: string,
    clientId: string,
    amountInPaise: number,
    description: string,
  ): Observable<PaymentIntent> {
    return this.api.post<PaymentIntent>('/payments/auth-hold', {
      caseId,
      clientId,
      amountInPaise,
      description,
    });
  }

  getPayments(filters?: PaymentFilters): Observable<Payment[]> {
    return this.api
      .get<ApiPayment[]>('/payments', filters)
      .pipe(map((payments) => payments.map((payment) => this.mapPayment(payment))));
  }

  getPaymentById(id: string): Observable<Payment> {
    return this.api
      .get<ApiPayment>(`/payments/${id}`)
      .pipe(map((payment) => this.mapPayment(payment)));
  }

  getPaymentsByCase(caseId: string): Observable<Payment[]> {
    return this.api
      .get<ApiPayment[]>(`/payments/case/${caseId}`)
      .pipe(map((payments) => payments.map((payment) => this.mapPayment(payment))));
  }

  refund(paymentId: string, reason: string): Observable<Payment> {
    return this.api
      .post<ApiPayment>(`/payments/${paymentId}/refund`, { reason })
      .pipe(map((payment) => this.mapPayment(payment)));
  }

  capturePayment(paymentId: string): Observable<Payment> {
    return this.api
      .post<ApiPayment>(`/payments/${paymentId}/capture`, {})
      .pipe(map((payment) => this.mapPayment(payment)));
  }

  requestVendorPayment(payload: RequestVendorPaymentPayload): Observable<Payment> {
    return this.api
      .post<ApiPayment>('/payments/vendor-request', payload)
      .pipe(map((payment) => this.mapPayment(payment)));
  }

  requestPayment(payload: RequestPaymentPayload): Observable<Payment> {
    return this.api
      .post<ApiPayment>('/payments/request', payload)
      .pipe(map((payment) => this.mapPayment(payment)));
  }

  markPaid(paymentId: string, receiptDocumentId?: string): Observable<Payment> {
    return this.api
      .post<ApiPayment>(`/payments/${paymentId}/mark-paid`, { receiptDocumentId })
      .pipe(map((payment) => this.mapPayment(payment)));
  }

  updatePaymentRequest(
    paymentId: string,
    payload: Partial<Omit<RequestPaymentPayload, 'caseId' | 'clientId'>>,
  ): Observable<Payment> {
    return this.api
      .patch<ApiPayment>(`/payments/${paymentId}`, payload)
      .pipe(map((payment) => this.mapPayment(payment)));
  }

  deletePaymentRequest(paymentId: string): Observable<{ deleted: boolean }> {
    return this.api.delete<{ deleted: boolean }>(`/payments/${paymentId}`);
  }
}
