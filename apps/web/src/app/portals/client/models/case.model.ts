export interface CaseManager {
  _id: string;
  name: string;
}

export interface Case {
  _id: string;
  caseNumber: string;
  title: string;
  serviceType: string;
  status: string;
  priority: string;
  caseManagerId?: CaseManager;
  propertyDetails?: PropertyDetails;
  timeline: Record<string, string>;
  stageHistory?: { stage: string; changedAt: string; note?: string }[];
  /** Set once closure has been requested; see the case closure flow. */
  closure?: {
    requestedAt?: string;
    windowEndsAt?: string;
    clientConfirmedAt?: string;
    issueRaisedAt?: string;
    issueResolvedAt?: string;
  };
  createdAt: string;
  updatedAt: string;
}

export interface PropertyDetails {
  address?: string;
  city?: string;
  state?: string;
  pincode?: string;
  type?: string;
  area?: number;
}

export interface Document {
  _id: string;
  name: string;
  category: string;
  caseId: string;
  uploadDate: string;
  url?: string;
}

export interface DashboardData {
  activeCases: number;
  pendingDocuments: number;
  pendingPayments: number;
  pendingRents: number;
  recentCases: Case[];
}
