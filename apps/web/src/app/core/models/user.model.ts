export interface User {
  _id: string;
  email: string;
  name: string;
  phone?: string | null;
  presence?: 'ONLINE' | 'AWAY';
  statusMessage?: string | null;
  role: Role;
  cluster?: 'PROPERTY' | 'TAX' | 'HYBRID';
  isActive: boolean;
  createdAt: string;
  updatedAt?: string;
}

export enum Role {
  ADMIN = 'ADMIN',
  CLIENT = 'CLIENT',
  CASE_MANAGER = 'CASE_MANAGER',
  VENDOR = 'VENDOR',
  QA = 'QA',
  OPS_FINANCE = 'OPS_FINANCE',
}

export interface RegisterData {
  email: string;
  password: string;
  name: string;
  recaptchaToken?: string;
}
