import { randomUUID } from "node:crypto";
import { makeCode } from "../codes";
import { addDays } from "../dates";
import { DEFAULT_PRIVATE, DEFAULT_SETTINGS, withDefaults } from "../defaults";
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
import { NotFoundError, type BookingFilter, type LotStore, type ReviewFilter } from "./types";

type State = {
  settings: LotSettings;
  priv: PrivateSettings;
  bookings: Booking[];
  members: Member[];
  payments: MemberPayment[];
  reviews: Review[];
  profiles: Profile[];
  audit: AuditEntry[];
};

function clone<T>(v: T): T {
  return structuredClone(v);
}

function nowIso(): string {
  return new Date().toISOString();
}

/**
 * Everything in memory. Survives Next.js hot reloads via globalThis so a dev session
 * doesn't lose its fake bookings every time a file is saved.
 */
export class MemoryStore implements LotStore {
  readonly kind = "memory" as const;
  private state: State;

  constructor(initial?: Partial<State>) {
    this.state = {
      settings: clone(DEFAULT_SETTINGS),
      priv: clone(DEFAULT_PRIVATE),
      bookings: [],
      members: [],
      payments: [],
      reviews: [],
      profiles: [],
      audit: [],
      ...initial,
    };
  }

  /** Test helper. */
  reset(initial?: Partial<State>): void {
    this.state = {
      settings: clone(DEFAULT_SETTINGS),
      priv: clone(DEFAULT_PRIVATE),
      bookings: [],
      members: [],
      payments: [],
      reviews: [],
      profiles: [],
      audit: [],
      ...initial,
    };
  }

  async getSettings(): Promise<LotSettings> {
    return clone(this.state.settings);
  }
  async saveSettings(patch: Partial<LotSettings>): Promise<LotSettings> {
    this.state.settings = withDefaults({ ...this.state.settings, ...patch });
    return clone(this.state.settings);
  }
  async getPrivateSettings(): Promise<PrivateSettings> {
    return clone(this.state.priv);
  }
  async savePrivateSettings(patch: Partial<PrivateSettings>): Promise<PrivateSettings> {
    this.state.priv = { ...this.state.priv, ...patch };
    return clone(this.state.priv);
  }

  async listBookings(filter: BookingFilter = {}): Promise<Booking[]> {
    let out = this.state.bookings.slice();
    if (filter.userId) out = out.filter((b) => b.userId === filter.userId);
    if (filter.status) out = out.filter((b) => filter.status!.includes(b.status));
    if (filter.from || filter.to) {
      const from = filter.from ?? "0000-01-01";
      const to = filter.to ?? "9999-12-31";
      out = out.filter((b) => {
        const last = addDays(b.arrive, b.nights - 1);
        return b.arrive <= to && last >= from;
      });
    }
    out.sort((a, b) => b.createdAt.localeCompare(a.createdAt));
    if (filter.limit) out = out.slice(0, filter.limit);
    return clone(out);
  }
  async getBooking(id: string): Promise<Booking | null> {
    return clone(this.state.bookings.find((b) => b.id === id) ?? null);
  }
  async getBookingByCode(code: string): Promise<Booking | null> {
    return clone(this.state.bookings.find((b) => b.code === code) ?? null);
  }
  async getBookingByPaymentRef(ref: string): Promise<Booking | null> {
    return clone(this.state.bookings.find((b) => b.paymentRef === ref) ?? null);
  }
  async createBooking(input: NewBooking): Promise<Booking> {
    const ts = nowIso();
    const b: Booking = { ...input, hidden: input.hidden ?? false, id: randomUUID(), code: input.code ?? this.uniqueCode(), kind: "nightly", createdAt: ts, updatedAt: ts };
    this.state.bookings.unshift(b);
    return clone(b);
  }
  async updateBooking(id: string, patch: Partial<Booking>): Promise<Booking> {
    const i = this.state.bookings.findIndex((b) => b.id === id);
    if (i < 0) throw new NotFoundError("booking");
    const cur = this.state.bookings[i]!;
    const next: Booking = { ...cur, ...patch, id: cur.id, code: cur.code, kind: "nightly", createdAt: cur.createdAt, updatedAt: nowIso() };
    this.state.bookings[i] = next;
    return clone(next);
  }
  async deleteBooking(id: string): Promise<void> {
    this.state.bookings = this.state.bookings.filter((b) => b.id !== id);
  }

  async listMembers(opts: { userId?: string; includeCancelled?: boolean } = {}): Promise<Member[]> {
    let out = this.state.members.slice();
    if (opts.userId) out = out.filter((m) => m.userId === opts.userId);
    if (!opts.includeCancelled) out = out.filter((m) => m.status !== "cancelled");
    out.sort((a, b) => a.started.localeCompare(b.started));
    return clone(out);
  }
  async getMember(id: string): Promise<Member | null> {
    return clone(this.state.members.find((m) => m.id === id) ?? null);
  }
  async getMemberByCode(code: string): Promise<Member | null> {
    return clone(this.state.members.find((m) => m.code === code) ?? null);
  }
  async getMemberByPaymentRef(ref: string): Promise<Member | null> {
    return clone(this.state.members.find((m) => m.paymentRef === ref) ?? null);
  }
  async createMember(input: NewMember): Promise<Member> {
    const ts = nowIso();
    const m: Member = { ...input, id: randomUUID(), code: input.code ?? this.uniqueCode(), kind: "monthly", createdAt: ts, updatedAt: ts };
    this.state.members.unshift(m);
    return clone(m);
  }
  async updateMember(id: string, patch: Partial<Member>): Promise<Member> {
    const i = this.state.members.findIndex((m) => m.id === id);
    if (i < 0) throw new NotFoundError("member");
    const cur = this.state.members[i]!;
    const next: Member = { ...cur, ...patch, id: cur.id, code: cur.code, kind: "monthly", createdAt: cur.createdAt, updatedAt: nowIso() };
    this.state.members[i] = next;
    return clone(next);
  }

  async listMemberPayments(memberId?: string): Promise<MemberPayment[]> {
    const out = memberId ? this.state.payments.filter((p) => p.memberId === memberId) : this.state.payments.slice();
    out.sort((a, b) => a.date.localeCompare(b.date));
    return clone(out);
  }
  async addMemberPayment(input: NewMemberPayment): Promise<MemberPayment> {
    const p: MemberPayment = { ...input, id: randomUUID() };
    this.state.payments.push(p);
    return clone(p);
  }

  async listReviews(filter: ReviewFilter = {}): Promise<Review[]> {
    let out = this.state.reviews.slice();
    if (filter.approvedOnly) out = out.filter((r) => r.approved);
    out.sort((a, b) => b.date.localeCompare(a.date) || b.createdAt.localeCompare(a.createdAt));
    if (filter.limit) out = out.slice(0, filter.limit);
    return clone(out);
  }
  async createReview(input: NewReview): Promise<Review> {
    const r: Review = { ...input, id: randomUUID(), createdAt: nowIso() };
    this.state.reviews.unshift(r);
    return clone(r);
  }
  async updateReview(id: string, patch: Partial<Review>): Promise<Review> {
    const i = this.state.reviews.findIndex((r) => r.id === id);
    if (i < 0) throw new NotFoundError("review");
    const next = { ...this.state.reviews[i]!, ...patch, id };
    this.state.reviews[i] = next;
    return clone(next);
  }
  async deleteReview(id: string): Promise<void> {
    this.state.reviews = this.state.reviews.filter((r) => r.id !== id);
  }

  async getProfile(id: string): Promise<Profile | null> {
    return clone(this.state.profiles.find((p) => p.id === id) ?? null);
  }
  async upsertProfile(profile: Pick<Profile, "id" | "email"> & Partial<Profile>): Promise<Profile> {
    const i = this.state.profiles.findIndex((p) => p.id === profile.id);
    const ts = nowIso();
    const base: Profile = i >= 0
      ? this.state.profiles[i]!
      : { id: profile.id, email: profile.email, fullName: "", phone: "", company: "", truck: "", plate: "", role: "driver", createdAt: ts, updatedAt: ts };
    const next: Profile = { ...base, ...profile, updatedAt: ts };
    if (i >= 0) this.state.profiles[i] = next;
    else this.state.profiles.push(next);
    return clone(next);
  }

  async appendAudit(entry: NewAuditEntry): Promise<AuditEntry> {
    const e: AuditEntry = { ...entry, id: randomUUID(), at: nowIso() };
    this.state.audit.unshift(e);
    if (this.state.audit.length > 500) this.state.audit.length = 500;
    return clone(e);
  }
  async listAudit(limit = 100): Promise<AuditEntry[]> {
    return clone(this.state.audit.slice(0, limit));
  }

  async clearOperationalData(): Promise<void> {
    this.state.bookings = [];
    this.state.members = [];
    this.state.payments = [];
    this.state.reviews = [];
    this.state.audit = [];
  }

  private uniqueCode(): string {
    for (let i = 0; i < 20; i++) {
      const c = makeCode();
      if (!this.state.bookings.some((b) => b.code === c) && !this.state.members.some((m) => m.code === c)) return c;
    }
    return makeCode(7);
  }
}
