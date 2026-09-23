import { Injectable } from '@angular/core';
import { Observable } from 'rxjs';
import { ApiService } from './api.service';

export interface InvoiceItem {
  description: string;
  quantity: number;
  unitPrice: number;
  amount: number;
}

export interface Invoice {
  _id: string;
  invoiceNumber: string;
  caseId: string;
  clientId: string;
  vendorId?: string;
  status: 'DRAFT' | 'ISSUED' | 'PAID' | 'CANCELLED';
  items: InvoiceItem[];
  subtotal: number;
  gst: number;
  totalAmount: number;
  currency: string;
  issuedAt?: string;
  paidAt?: string;
  dueDate?: string;
  notes?: string;
  createdAt: string;
  updatedAt: string;
}

@Injectable({ providedIn: 'root' })
export class InvoicingService {
  constructor(private api: ApiService) {}

  getAll(filters?: { caseId?: string; clientId?: string; status?: string }): Observable<Invoice[]> {
    return this.api.get<Invoice[]>('/invoices', filters as Record<string, string | undefined>);
  }

  getByCase(caseId: string): Observable<Invoice[]> {
    return this.api.get<Invoice[]>(`/invoices/case/${caseId}`);
  }

  getById(id: string): Observable<Invoice> {
    return this.api.get<Invoice>(`/invoices/${id}`);
  }

  issue(id: string): Observable<Invoice> {
    return this.api.post<Invoice>(`/invoices/${id}/issue`, {});
  }

  markPaid(id: string): Observable<Invoice> {
    return this.api.post<Invoice>(`/invoices/${id}/mark-paid`, {});
  }
}
