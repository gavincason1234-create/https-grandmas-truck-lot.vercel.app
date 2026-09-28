/**
 * Domain types for Grandma's Truck Lot.
 * Money is always stored in whole cents. Dates are ISO `YYYY-MM-DD` strings in the lot's local day.
 */

export type SecurityFlags = {
  lit: boolean;
  gated: boolean;
  cameras: boolean;
  fenced: boolean;
};

export type OverheadLine = { name: string; amountCents: number };

export type Photo = { src: string; caption: string };

/** Public lot settings — safe for any visitor to read. */
export type LotSettings = {
  lotName: string;
  address: string;
  /** Free-text approach notes written for truck drivers, not car GPS. */
  truckDirections: string;
  lat: number | null;
  lng: number | null;
  phone: string;
  /** Number drivers can text. Defaults to `phone` when blank. */
  smsPhone: string;
  spots: number;
  nightlyCents: number;
  monthlyCents: number;
  showerCents: number;
  laundryCents: number;
  /** Whether nightly guests can add shower / laundry. Monthly always includes them. */
  nightlyExtras: boolean;
  notes: string;
  policy: string;
  security: SecurityFlags;
  overhead: OverheadLine[];
  photos: Photo[];
  /** A photo shown behind the whole site, tinted for readability. Blank = the built-in look. */
  backgroundUrl: string;
  /** Max trailer length the lot comfortably fits, in feet. */
  maxLengthFt: number;
  /** Shown on the home page while payments are simulated. */
  testMode: boolean;
};

/** Gate + shed codes. Only admins and drivers with a paid stay ever see these. */
export type PrivateSettings = {
  gate1: string;
  gate2: string;
  shedCode: string;
};

export type Extras = { showers: number; loads: number };

export type BookingStatus =
  | "pending_payment"
  | "reserved"
  | "parked"
  | "departed"
  | "cancelled";

export type Booking = {
  id: string;
  code: string;
  kind: "nightly";
  userId: string | null;
  name: string;
  phone: string;
  company: string;
  truck: string;
  plate: string;
  arrive: string;
  nights: number;
  extras: Extras;
  amountCents: number;
  paid: boolean;
  status: BookingStatus;
  paymentRef: string | null;
  /** Tidied off the owner's Tonight list. Still counts on the Money tab. */
  hidden: boolean;
  createdAt: string;
  updatedAt: string;
};

export type MemberStatus = "pending_payment" | "active" | "past_due" | "cancelled";

export type Member = {
  id: string;
  code: string;
  kind: "monthly";
  userId: string | null;
  name: string;
  phone: string;
  company: string;
  truck: string;
  plate: string;
  started: string;
  nextBill: string;
  amountCents: number;
  status: MemberStatus;
  ended: string | null;
  paymentRef: string | null;
  createdAt: string;
  updatedAt: string;
};

export type MemberPayment = {
  id: string;
  memberId: string;
  date: string;
  amountCents: number;
  note: string;
};

export type Review = {
  id: string;
  userId: string | null;
  bookingCode: string | null;
  name: string;
  stars: number;
  text: string;
  date: string;
  approved: boolean;
  createdAt: string;
};

export type Role = "driver" | "admin";

export type Profile = {
  id: string;
  email: string;
  fullName: string;
  phone: string;
  company: string;
  truck: string;
  plate: string;
  role: Role;
  createdAt: string;
  updatedAt: string;
};

export type AuditEntry = {
  id: string;
  actor: string;
  action: string;
  target: string;
  meta: Record<string, unknown>;
  at: string;
};

/** Inputs */
export type NewBooking = Omit<
  Booking,
  "id" | "code" | "kind" | "createdAt" | "updatedAt" | "hidden"
> & { code?: string; hidden?: boolean };

export type NewMember = Omit<
  Member,
  "id" | "code" | "kind" | "createdAt" | "updatedAt"
> & { code?: string };

export type NewReview = Omit<Review, "id" | "createdAt">;

export type NewMemberPayment = Omit<MemberPayment, "id">;

export type NewAuditEntry = Omit<AuditEntry, "id" | "at">;

/** A user as seen by the app, regardless of which auth backend produced it. */
export type SessionUser = {
  id: string;
  email: string;
  name: string;
  avatarUrl: string | null;
  /** True when the email is on the admin allowlist in the vault (or ADMIN_EMAILS). */
  isAdmin: boolean;
};
