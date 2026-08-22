export type ClientType = "Vendor" | "Buyer";

export type CaseStatus = 
  | "Viewing" 
  | "Booking Paid" 
  | "Loan Approved" 
  | "SPA Signed" 
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

  // Vendor (Penjual) details
  vendorName: string;
  vendorIC?: string;
  vendorPhone?: string;

  // Buyer (Pembeli) details
  buyerName: string;
  buyerIC?: string;
  buyerPhone?: string;

  // Legacy fields — kept optional for backward compat with older records
  clientType?: ClientType;
  clientName?: string;

  finance: FinanceType;
  financeNotes?: string; // e.g. bank name, margin of finance
  status: CaseStatus;
  statusNotes?: string; // e.g. reason for pending, action items
  catatan: string; // General notes

  // Follow-Up Reminder fields
  reminderDate?: string; // ISO 8601 string for scheduled reminder
  reminderNote?: string; // What to follow up on
  notificationId?: string; // Expo local notification ID

  // Status Change History
  statusHistory?: string[];

  createdAt: string; // ISO 8601 timestamp
  updatedAt: string; // ISO 8601 timestamp
}

export interface UserProfile {
  uid: string;
  email: string;
  displayName: string;
  photoURL?: string;
  phoneNumber?: string;
  phone?: string;
}

export interface CaseMetrics {
  totalCases: number;
  aktif: number;
  booking: number;
  underLoan: number;
  underSpa: number;
  sold: number;
  expired: number;
}
