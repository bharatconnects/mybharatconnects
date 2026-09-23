import { Injectable } from '@angular/core';
import { Observable } from 'rxjs';
import { ApiService } from './api.service';

export type ActionItemStatus = 'OPEN' | 'DONE' | 'CANCELLED';

export interface ActionItem {
  _id: string;
  caseId: string;
  owner: string | { name?: string; email?: string };
  text: string;
  dueDate?: string;
  status: ActionItemStatus;
  createdBy: string;
  completedAt?: string;
  createdAt: string;
  updatedAt: string;
}

export interface CreateActionItemDto {
  owner: string;
  text: string;
  dueDate?: string;
}

@Injectable({ providedIn: 'root' })
export class ActionItemsService {
  constructor(private api: ApiService) {}

  getByCase(caseId: string): Observable<ActionItem[]> {
    return this.api.get<ActionItem[]>(`/cases/${caseId}/actions`);
  }

  create(caseId: string, dto: CreateActionItemDto): Observable<ActionItem> {
    return this.api.post<ActionItem>(`/cases/${caseId}/actions`, dto);
  }

  updateStatus(id: string, status: ActionItemStatus): Observable<ActionItem> {
    return this.api.patch<ActionItem>(`/actions/${id}`, { status });
  }

  remove(id: string): Observable<{ message: string }> {
    return this.api.delete<{ message: string }>(`/actions/${id}`);
  }
}
