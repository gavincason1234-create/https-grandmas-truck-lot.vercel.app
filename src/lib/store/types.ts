import type {
  AuditEntry,
  Booking,
  LotSettings,
  Member,
  MemberPayment,
  NewAuditEntry,
  NewBooking,
  NewMember,
  NewMemberPayment,
  NewReview,
  PrivateSettings,
  Profile,
  Review,
} from "../types";

export type BookingFilter = {
  /** Include bookings that hold a stall on any day in [from, to]. */
  from?: string;
  to?: string;
  status?: Booking["status"][];
  userId?: string;
  limit?: number;
};

export type ReviewFilter = { approvedOnly?: boolean; limit?: number };

/**
 * Everything the app knows how to remember. Two implementations:
 *  - SupabaseStore: the real database, used by the server with the service role key.
 *  - MemoryStore:   in-process arrays for local development and automated tests.
 */
export interface LotStore {
  readonly kind: "supabase" | "memory";

  getSettings(): Promise<LotSettings>;
  saveSettings(patch: Partial<LotSettings>): Promise<LotSettings>;
  getPrivateSettings(): Promise<PrivateSettings>;
  savePrivateSettings(patch: Partial<PrivateSettings>): Promise<PrivateSettings>;

  listBookings(filter?: BookingFilter): Promise<Booking[]>;
  getBooking(id: string): Promise<Booking | null>;
  getBookingByCode(code: string): Promise<Booking | null>;
  getBookingByPaymentRef(ref: string): Promise<Booking | null>;
  createBooking(input: NewBooking): Promise<Booking>;
  updateBooking(id: string, patch: Partial<Omit<Booking, "id" | "code" | "kind" | "createdAt">>): Promise<Booking>;
  deleteBooking(id: string): Promise<void>;

  listMembers(opts?: { userId?: string; includeCancelled?: boolean }): Promise<Member[]>;
  getMember(id: string): Promise<Member | null>;
  getMemberByCode(code: string): Promise<Member | null>;
  getMemberByPaymentRef(ref: string): Promise<Member | null>;
  createMember(input: NewMember): Promise<Member>;
  updateMember(id: string, patch: Partial<Omit<Member, "id" | "code" | "kind" | "createdAt">>): Promise<Member>;

  listMemberPayments(memberId?: string): Promise<MemberPayment[]>;
  addMemberPayment(input: NewMemberPayment): Promise<MemberPayment>;

  listReviews(filter?: ReviewFilter): Promise<Review[]>;
  createReview(input: NewReview): Promise<Review>;
  updateReview(id: string, patch: Partial<Pick<Review, "approved" | "text" | "stars" | "name">>): Promise<Review>;
  deleteReview(id: string): Promise<void>;

  getProfile(id: string): Promise<Profile | null>;
  upsertProfile(profile: Pick<Profile, "id" | "email"> & Partial<Profile>): Promise<Profile>;

  appendAudit(entry: NewAuditEntry): Promise<AuditEntry>;
  listAudit(limit?: number): Promise<AuditEntry[]>;

  /** Wipe bookings, members, payments, reviews, and audit — settings stay. Used by the admin "clear test data" button. */
  clearOperationalData(): Promise<void>;
}

export class StoreError extends Error {
  constructor(
    message: string,
    public readonly status: number = 500,
    public readonly code: string = "store_error",
  ) {
    super(message);
    this.name = "StoreError";
  }
}

export class NotFoundError extends StoreError {
  constructor(what: string) {
    super(`${what} not found`, 404, "not_found");
    this.name = "NotFoundError";
  }
}
