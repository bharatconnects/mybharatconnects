import { Injectable } from '@angular/core';
import { Observable } from 'rxjs';
import { ApiService } from './api.service';

export type AdvanceMode = 'PERCENT' | 'FIXED';

export interface AdvanceChange {
  at: string;
  byRole?: string;
  from: { mode: AdvanceMode; advancePercent: number; advanceAmount?: number };
  to: { mode: AdvanceMode; advancePercent: number; advanceAmount?: number };
  note?: string;
  arrangementNote?: string;
}

/** What a case has paid and delivered against the rules that gate its stages. Amounts are minor units (cents) in USD. */
export interface CaseCheckpoints {
  caseId: string;
  quoteId: string | null;
  hasAcceptedQuote: boolean;
  /** Stripe charges, and every amount here, are in US dollars. */
  currency: string;
  /** What the accepted quote is written in, when that is not dollars. */
  quoteCurrency: string | null;
  currencyMismatch: boolean;
  contractTotal: number;
  paid: number;
  /** Asked of the client but not paid or approved yet. */
  requested: number;
  policy: {
    mode: AdvanceMode;
    advancePercent: number;
    advanceAmount: number | null;
    advanceConfigured: boolean;
    source: 'SETTINGS' | 'ADJUSTED';
    arrangementNote: string | null;
    finalPaymentGateEnabled: boolean;
    deliveryGateEnabled: boolean;
    /** Staff only; empty for the client. */
    history: AdvanceChange[];
  };
  advance: {
    mode: AdvanceMode;
    percent: number;
    required: number;
    paid: number;
    remaining: number;
    satisfied: boolean;
    reason?: 'NO_ACCEPTED_QUOTE';
  };
  final: {
    enforced: boolean;
    required: number;
    paid: number;
    remaining: number;
    unrequested: number;
    satisfied: boolean;
  };
  delivery: { enforced: boolean; total: number; delivered: number; satisfied: boolean };
}

export interface AdvanceTermsInput {
  mode: AdvanceMode;
  advancePercent?: number;
  /** Cents. */
  advanceAmount?: number;
  note: string;
  arrangementNote?: string;
}

export interface PaymentPolicy {
  advancePercent: number;
  finalPaymentGateEnabled: boolean;
  deliveryGateEnabled: boolean;
  closeWindowHours: number;
  updatedAt?: string;
}

@Injectable({ providedIn: 'root' })
export class CheckpointsService {
  constructor(private api: ApiService) {}

  getCheckpoints(caseId: string): Observable<CaseCheckpoints> {
    return this.api.get<CaseCheckpoints>(`/cases/${caseId}/checkpoints`);
  }

  getPaymentPolicy(): Observable<PaymentPolicy> {
    return this.api.get<PaymentPolicy>('/settings/payment-policy');
  }

  updatePaymentPolicy(
    changes: Partial<Omit<PaymentPolicy, 'updatedAt'>> & { note?: string },
  ): Observable<PaymentPolicy> {
    return this.api.patch<PaymentPolicy>('/settings/payment-policy', changes);
  }

  /** The advance agreed with the client for this case (percentage or fixed amount), with the reason. */
  setCaseAdvance(caseId: string, terms: AdvanceTermsInput): Observable<CaseCheckpoints> {
    return this.api.patch<CaseCheckpoints>(`/cases/${caseId}/payment-policy`, terms);
  }

  /** Asks the client for whatever part of the quote is neither paid nor already requested. */
  requestBalance(caseId: string): Observable<unknown> {
    return this.api.post<unknown>(`/cases/${caseId}/request-balance`, {});
  }
}

/** Formats a minor-unit amount for display, for example "INR 3,000.00". */
export function formatMinor(minor: number, currency: string | null): string {
  const value = (minor / 100).toLocaleString('en-IN', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
  return `${currency ?? ''} ${value}`.trim();
}
