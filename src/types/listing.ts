export type PeganganType = "Freehold" | "Leasehold";

export type LotStatusType = "Bumi Lot" | "Non-Bumi Lot" | "Malay Reserve";

export type ListingStatus =
  | "Aktif"
  | "Booking"
  | "Under Loan"
  | "Under SPA"
  | "Sold"
  | "Terjual"
  | "Draft"
  | "Expired"
  | "Sewa";

export interface PropertyLocation {
  latitude: number;
  longitude: number;
}

export interface PropertyListing {
  id: string;
  agentId: string;
  status: ListingStatus;

  // Maklumat Asas
  tajuk: string;
  description?: string;
  harga: number | string;
  alamat: string;
  negeri: string;
  jenis: string;

  // Maklumat Hartanah
  pegangan: PeganganType | string;
  lot: LotStatusType | string;
  bilikTidur: number | string;
  bilikAir: number | string;
  keluasan: number | string;

  // GPS Location (Phase 2)
  location?: PropertyLocation | null;

  // Maklumat Owner
  namaOwner: string;
  telOwner: string;

  // Document & Image URLs (Phase 2)
  gambar: string[];
  geran: string;
  icOwner: string;
  spa: string;
  bilUtility: string;

  // Additional fields for cross-compatibility and authorship
  imageUrl?: string;
  images?: string[];
  userId?: string;
  authorName?: string;
  agentName?: string;
  agentPhone?: string;
  navLink?: string;

  createdAt?: string;
  updatedAt?: string;
}
