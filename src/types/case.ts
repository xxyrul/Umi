export type ClientType = "Vendor" | "Buyer";

export type CaseStatus = 
  | "Viewing" 
  | "Booking Paid" 
  | "SPA Signed" 
  | "Loan Approved" 
  | "Completed" 
  | "Cancelled"
  | "Pending"
  | "Review";

export type FinanceType = 
  | "Bank Loan" 
  | "Cash" 
  | "Developer Loan" 
  | "Other";

export interface PropertyCase {
  id: string;
  userId: string;
  tarikh: string; // ISO 8601 date string
  namaCase: string; // Property name/address
  clientType: ClientType;
  clientName: string;
  finance: FinanceType;
  status: CaseStatus;
  catatan: string; // Notes
  createdAt: string; // ISO 8601 timestamp
  updatedAt: string; // ISO 8601 timestamp
}

export interface UserProfile {
  uid: string;
  email: string;
  displayName: string;
  photoURL?: string;
}

export interface CaseMetrics {
  totalCases: number;
  pending: number;
  approved: number;
  completed: number;
}
