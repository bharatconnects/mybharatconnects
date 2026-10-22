import { Injectable } from '@angular/core';
import { map, Observable } from 'rxjs';
import { ApiService } from './api.service';

export interface PaymentIntent {
  paymentIntentId: string;
  clientSecret: string;
}

export type PaymentPurpose = 'TOKEN' | 'PARTIAL' | 'MILESTONE' | 'FULL';
export type PaymentDirection = 'CLIENT_TO_CM' | 'CM_TO_VENDOR';
export type OfflinePaymentMethod = 'BANK_TRANSFER' | 'UPI' | 'CASH' | 'CHEQUE' | 'OTHER';
export type OfflineApprovalStatus = 'PENDING_APPROVAL' | 'APPROVED' | 'REJECTED';

export interface OfflinePaymentDetails {
  method: OfflinePaymentMethod;
  reference?: string;
  proofDocumentId?: string;
  note?: string;
  status: OfflineApprovalStatus;
  requestedBy?: string | { _id: string; name?: string; email?: string };
  requestedAt?: string;
  decidedBy?: string | { _id: string; name?: string; email?: string };
  decidedAt?: string;
  decisionNote?: string;
}

export const OFFLINE_METHOD_LABEL: Record<OfflinePaymentMethod, string> = {
  BANK_TRANSFER: 'Bank transfer',
  UPI: 'UPI',
  CASH: 'Cash',
  CHEQUE: 'Cheque',
  OTHER: 'Other',
};

export interface RequestOfflinePaymentPayload {
  caseId: string;
  amountInPaise: number;
  purpose: PaymentPurpose;
  method: OfflinePaymentMethod;
  reference?: string;
  description: string;
  note: string;
  proofDocumentId?: string;
  quoteId?: string;
  milestoneId?: string;
  supersedesPaymentId?: string;
}

export interface PaymentAuditEvent {
  _id: string;
  type: string;
  source: string;
  actorRole?: string;
  actorUserId?: string | { _id: string; name?: string; email?: string };
  fromStatus?: string;
  toStatus?: string;
  amount?: number;
  note?: string;
  createdAt: string;
}

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
  status:
    | 'pending'
    | 'pending_approval'
    | 'authorized'
    | 'captured'
    | 'failed'
    | 'refunded'
    | 'rejected';
  provider?: 'STRIPE' | 'OFFLINE';
  settlement?: 'STRIPE' | 'OFFLINE_APPROVED' | 'LEGACY_MANUAL';
  offline?: OfflinePaymentDetails;
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
  provider?: 'STRIPE' | 'OFFLINE';
  settlement?: 'STRIPE' | 'OFFLINE_APPROVED' | 'LEGACY_MANUAL';
  offline?: OfflinePaymentDetails;
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
      normalized === 'pending_approval' ||
      normalized === 'rejected' ||
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
      provider: payment.provider,
      settlement: payment.settlement,
      offline: payment.offline,
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

  /** Record a client payment received outside Stripe. Counts for nothing until an Admin approves it. */
  requestOfflinePayment(payload: RequestOfflinePaymentPayload): Observable<Payment> {
    return this.api
      .post<ApiPayment>('/payments/offline-request', payload)
      .pipe(map((payment) => this.mapPayment(payment)));
  }

  getOfflineRequests(status?: OfflineApprovalStatus): Observable<Payment[]> {
    return this.api
      .get<ApiPayment[]>('/payments/offline-requests', status ? { status } : undefined)
      .pipe(map((payments) => payments.map((payment) => this.mapPayment(payment))));
  }

  approveOffline(paymentId: string, note?: string): Observable<Payment> {
    return this.api
      .post<ApiPayment>(`/payments/${paymentId}/offline/approve`, { note })
      .pipe(map((payment) => this.mapPayment(payment)));
  }

  rejectOffline(paymentId: string, note: string): Observable<Payment> {
    return this.api
      .post<ApiPayment>(`/payments/${paymentId}/offline/reject`, { note })
      .pipe(map((payment) => this.mapPayment(payment)));
  }

  /** Re-checks a Stripe payment with Stripe. It can only report what Stripe says; it cannot mark anything paid. */
  syncWithStripe(paymentId: string): Observable<Payment> {
    return this.api
      .post<ApiPayment>(`/payments/${paymentId}/sync`, {})
      .pipe(map((payment) => this.mapPayment(payment)));
  }

  getAuditEvents(paymentId: string): Observable<PaymentAuditEvent[]> {
    return this.api.get<PaymentAuditEvent[]>(`/payments/${paymentId}/events`);
  }

  /** Asks the client to pay an approved milestone through Stripe. */
  requestMilestonePayment(quoteId: string, milestoneId: string): Observable<Payment> {
    return this.api
      .post<ApiPayment>(`/quotes/${quoteId}/milestones/${milestoneId}/request-payment`, {})
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
