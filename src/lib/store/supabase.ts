import type { SupabaseClient } from "@supabase/supabase-js";
import { makeCode } from "../codes";
import { addDays } from "../dates";
import { withDefaults } from "../defaults";
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
import { NotFoundError, StoreError, type BookingFilter, type LotStore, type ReviewFilter } from "./types";

/* ---------- row shapes (snake_case, as stored) ---------- */
type BookingRow = {
  id: string; code: string; user_id: string | null; name: string; phone: string; company: string; truck: string; plate: string;
  arrive: string; nights: number; extras: { showers?: number; loads?: number } | null; amount_cents: number; paid: boolean;
  status: Booking["status"]; payment_ref: string | null; hidden: boolean | null; created_at: string; updated_at: string;
};
type MemberRow = {
  id: string; code: string; user_id: string | null; name: string; phone: string; company: string; truck: string; plate: string;
  started: string; next_bill: string; amount_cents: number; status: Member["status"]; ended: string | null; payment_ref: string | null;
  created_at: string; updated_at: string;
};
type PaymentRow = { id: string; member_id: string; date: string; amount_cents: number; note: string };
type ReviewRow = { id: string; user_id: string | null; booking_code: string | null; name: string; stars: number; text: string; date: string; approved: boolean; created_at: string };
type ProfileRow = { id: string; email: string; full_name: string; phone: string; company: string; truck: string; plate: string; role: Profile["role"]; created_at: string; updated_at: string };
type AuditRow = { id: number; actor: string; action: string; target: string; meta: Record<string, unknown>; at: string };

const bookingFromRow = (r: BookingRow): Booking => ({
  id: r.id, code: r.code, kind: "nightly", userId: r.user_id, name: r.name, phone: r.phone, company: r.company, truck: r.truck, plate: r.plate,
  arrive: r.arrive, nights: r.nights, extras: { showers: r.extras?.showers ?? 0, loads: r.extras?.loads ?? 0 }, amountCents: r.amount_cents,
  paid: r.paid, status: r.status, paymentRef: r.payment_ref, hidden: r.hidden ?? false, createdAt: r.created_at, updatedAt: r.updated_at,
});
const bookingToRow = (b: Partial<Booking>): Partial<BookingRow> => {
  const r: Partial<BookingRow> = {};
  if (b.userId !== undefined) r.user_id = b.userId;
  if (b.name !== undefined) r.name = b.name;
  if (b.phone !== undefined) r.phone = b.phone;
  if (b.company !== undefined) r.company = b.company;
  if (b.truck !== undefined) r.truck = b.truck;
  if (b.plate !== undefined) r.plate = b.plate;
  if (b.arrive !== undefined) r.arrive = b.arrive;
  if (b.nights !== undefined) r.nights = b.nights;
  if (b.extras !== undefined) r.extras = b.extras;
  if (b.amountCents !== undefined) r.amount_cents = b.amountCents;
  if (b.paid !== undefined) r.paid = b.paid;
  if (b.status !== undefined) r.status = b.status;
  if (b.paymentRef !== undefined) r.payment_ref = b.paymentRef;
  if (b.hidden !== undefined) r.hidden = b.hidden;
  return r;
};

const memberFromRow = (r: MemberRow): Member => ({
  id: r.id, code: r.code, kind: "monthly", userId: r.user_id, name: r.name, phone: r.phone, company: r.company, truck: r.truck, plate: r.plate,
  started: r.started, nextBill: r.next_bill, amountCents: r.amount_cents, status: r.status, ended: r.ended, paymentRef: r.payment_ref,
  createdAt: r.created_at, updatedAt: r.updated_at,
});
const memberToRow = (m: Partial<Member>): Partial<MemberRow> => {
  const r: Partial<MemberRow> = {};
  if (m.userId !== undefined) r.user_id = m.userId;
  if (m.name !== undefined) r.name = m.name;
  if (m.phone !== undefined) r.phone = m.phone;
  if (m.company !== undefined) r.company = m.company;
  if (m.truck !== undefined) r.truck = m.truck;
  if (m.plate !== undefined) r.plate = m.plate;
  if (m.started !== undefined) r.started = m.started;
  if (m.nextBill !== undefined) r.next_bill = m.nextBill;
  if (m.amountCents !== undefined) r.amount_cents = m.amountCents;
  if (m.status !== undefined) r.status = m.status;
  if (m.ended !== undefined) r.ended = m.ended;
  if (m.paymentRef !== undefined) r.payment_ref = m.paymentRef;
  return r;
};

const paymentFromRow = (r: PaymentRow): MemberPayment => ({ id: r.id, memberId: r.member_id, date: r.date, amountCents: r.amount_cents, note: r.note });
const reviewFromRow = (r: ReviewRow): Review => ({ id: r.id, userId: r.user_id, bookingCode: r.booking_code, name: r.name, stars: r.stars, text: r.text, date: r.date, approved: r.approved, createdAt: r.created_at });
const profileFromRow = (r: ProfileRow): Profile => ({ id: r.id, email: r.email, fullName: r.full_name, phone: r.phone, company: r.company, truck: r.truck, plate: r.plate, role: r.role, createdAt: r.created_at, updatedAt: r.updated_at });
const auditFromRow = (r: AuditRow): AuditEntry => ({ id: String(r.id), actor: r.actor, action: r.action, target: r.target, meta: r.meta ?? {}, at: r.at });

const PAGE = 1000;

/**
 * PostgREST answers at most 1000 rows per request. Keep asking until a page comes back short so
 * all-time totals on the Money tab never quietly stop growing.
 */
async function fetchAll<T>(build: () => { range(from: number, to: number): PromiseLike<{ data: unknown; error: { message: string; code?: string } | null }> }, where: string, limit?: number): Promise<T[]> {
  const out: T[] = [];
  for (let from = 0; ; from += PAGE) {
    const to = limit ? Math.min(from + PAGE, limit) - 1 : from + PAGE - 1;
    if (to < from) break;
    const { data, error } = await build().range(from, to);
    if (error) fail(where, error);
    const rows = (data ?? []) as T[];
    out.push(...rows);
    if (rows.length < to - from + 1 || (limit && out.length >= limit)) break;
  }
  return out;
}

function fail(where: string, error: { message: string; code?: string } | null): never {
  throw new StoreError(`${where}: ${error?.message ?? "unknown error"}`, 500, error?.code ?? "db_error");
}

/**
 * Talks to Postgres through the Supabase service role. Only ever constructed on the server.
 * Everything a driver is allowed to see or do is decided in the route handlers, not here.
 */
export class SupabaseStore implements LotStore {
  readonly kind = "supabase" as const;
  constructor(private readonly db: SupabaseClient) {}

  /* ---------- settings ---------- */
  async getSettings(): Promise<LotSettings> {
    const { data, error } = await this.db.from("lot_settings").select("data").eq("id", 1).maybeSingle();
    if (error) fail("getSettings", error);
    return withDefaults((data?.data ?? {}) as Partial<LotSettings>);
  }
  async saveSettings(patch: Partial<LotSettings>): Promise<LotSettings> {
    const current = await this.getSettings();
    const next = withDefaults({ ...current, ...patch });
    const { error } = await this.db.from("lot_settings").upsert({ id: 1, data: next, updated_at: new Date().toISOString() });
    if (error) fail("saveSettings", error);
    return next;
  }
  async getPrivateSettings(): Promise<PrivateSettings> {
    const { data, error } = await this.db.from("lot_private_settings").select("data").eq("id", 1).maybeSingle();
    if (error) fail("getPrivateSettings", error);
    // No made-up defaults here: until the owner types the real codes, drivers are told to call.
    return { gate1: "", gate2: "", shedCode: "", ...((data?.data ?? {}) as Partial<PrivateSettings>) };
  }
  async savePrivateSettings(patch: Partial<PrivateSettings>): Promise<PrivateSettings> {
    const next = { ...(await this.getPrivateSettings()), ...patch };
    const { error } = await this.db.from("lot_private_settings").upsert({ id: 1, data: next, updated_at: new Date().toISOString() });
    if (error) fail("savePrivateSettings", error);
    return next;
  }

  /* ---------- bookings ---------- */
  async listBookings(filter: BookingFilter = {}): Promise<Booking[]> {
    const build = () => {
      let q = this.db.from("bookings").select("*").order("created_at", { ascending: false });
      if (filter.userId) q = q.eq("user_id", filter.userId);
      if (filter.status) q = q.in("status", filter.status);
      if (filter.to) q = q.lte("arrive", filter.to);
      // A stay can start up to 29 days before `from` and still cover it; filter precisely in memory below.
      if (filter.from) q = q.gte("arrive", addDays(filter.from, -30));
      return q;
    };
    let out = (await fetchAll<BookingRow>(build, "listBookings", filter.limit)).map(bookingFromRow);
    if (filter.from) out = out.filter((b) => addDays(b.arrive, b.nights - 1) >= filter.from!);
    return out;
  }
  async getBooking(id: string): Promise<Booking | null> {
    const { data, error } = await this.db.from("bookings").select("*").eq("id", id).maybeSingle();
    if (error) fail("getBooking", error);
    return data ? bookingFromRow(data as BookingRow) : null;
  }
  async getBookingByCode(code: string): Promise<Booking | null> {
    const { data, error } = await this.db.from("bookings").select("*").eq("code", code).maybeSingle();
    if (error) fail("getBookingByCode", error);
    return data ? bookingFromRow(data as BookingRow) : null;
  }
  async getBookingByPaymentRef(ref: string): Promise<Booking | null> {
    const { data, error } = await this.db.from("bookings").select("*").eq("payment_ref", ref).maybeSingle();
    if (error) fail("getBookingByPaymentRef", error);
    return data ? bookingFromRow(data as BookingRow) : null;
  }
  async createBooking(input: NewBooking): Promise<Booking> {
    for (let attempt = 0; attempt < 5; attempt++) {
      const code = input.code ?? makeCode(attempt < 3 ? 5 : 7);
      const { data, error } = await this.db.from("bookings").insert({ ...bookingToRow(input), code }).select("*").single();
      if (!error) return bookingFromRow(data as BookingRow);
      if (error.code === "23505" && !input.code) continue; // code collision, try another
      fail("createBooking", error);
    }
    throw new StoreError("could not allocate a booking code", 500, "code_exhausted");
  }
  async updateBooking(id: string, patch: Partial<Booking>): Promise<Booking> {
    const { data, error } = await this.db.from("bookings").update(bookingToRow(patch)).eq("id", id).select("*").maybeSingle();
    if (error) fail("updateBooking", error);
    if (!data) throw new NotFoundError("booking");
    return bookingFromRow(data as BookingRow);
  }
  async deleteBooking(id: string): Promise<void> {
    const { error } = await this.db.from("bookings").delete().eq("id", id);
    if (error) fail("deleteBooking", error);
  }

  /* ---------- members ---------- */
  async listMembers(opts: { userId?: string; includeCancelled?: boolean } = {}): Promise<Member[]> {
    const build = () => {
      let q = this.db.from("members").select("*").order("started", { ascending: true });
      if (opts.userId) q = q.eq("user_id", opts.userId);
      if (!opts.includeCancelled) q = q.neq("status", "cancelled");
      return q;
    };
    return (await fetchAll<MemberRow>(build, "listMembers")).map(memberFromRow);
  }
  async getMember(id: string): Promise<Member | null> {
    const { data, error } = await this.db.from("members").select("*").eq("id", id).maybeSingle();
    if (error) fail("getMember", error);
    return data ? memberFromRow(data as MemberRow) : null;
  }
  async getMemberByCode(code: string): Promise<Member | null> {
    const { data, error } = await this.db.from("members").select("*").eq("code", code).maybeSingle();
    if (error) fail("getMemberByCode", error);
    return data ? memberFromRow(data as MemberRow) : null;
  }
  async getMemberByPaymentRef(ref: string): Promise<Member | null> {
    const { data, error } = await this.db.from("members").select("*").eq("payment_ref", ref).maybeSingle();
    if (error) fail("getMemberByPaymentRef", error);
    return data ? memberFromRow(data as MemberRow) : null;
  }
  async createMember(input: NewMember): Promise<Member> {
    for (let attempt = 0; attempt < 5; attempt++) {
      const code = input.code ?? makeCode(attempt < 3 ? 5 : 7);
      const { data, error } = await this.db.from("members").insert({ ...memberToRow(input), code }).select("*").single();
      if (!error) return memberFromRow(data as MemberRow);
      if (error.code === "23505" && !input.code) continue;
      fail("createMember", error);
    }
    throw new StoreError("could not allocate a member code", 500, "code_exhausted");
  }
  async updateMember(id: string, patch: Partial<Member>): Promise<Member> {
    const { data, error } = await this.db.from("members").update(memberToRow(patch)).eq("id", id).select("*").maybeSingle();
    if (error) fail("updateMember", error);
    if (!data) throw new NotFoundError("member");
    return memberFromRow(data as MemberRow);
  }

  async listMemberPayments(memberId?: string): Promise<MemberPayment[]> {
    const build = () => {
      let q = this.db.from("member_payments").select("*").order("date", { ascending: true });
      if (memberId) q = q.eq("member_id", memberId);
      return q;
    };
    return (await fetchAll<PaymentRow>(build, "listMemberPayments")).map(paymentFromRow);
  }
  async addMemberPayment(input: NewMemberPayment): Promise<MemberPayment> {
    const { data, error } = await this.db.from("member_payments").insert({ member_id: input.memberId, date: input.date, amount_cents: input.amountCents, note: input.note }).select("*").single();
    if (error) fail("addMemberPayment", error);
    return paymentFromRow(data as PaymentRow);
  }

  /* ---------- reviews ---------- */
  async listReviews(filter: ReviewFilter = {}): Promise<Review[]> {
    const build = () => {
      let q = this.db.from("reviews").select("*").order("date", { ascending: false }).order("created_at", { ascending: false });
      if (filter.approvedOnly) q = q.eq("approved", true);
      return q;
    };
    return (await fetchAll<ReviewRow>(build, "listReviews", filter.limit)).map(reviewFromRow);
  }
  async createReview(input: NewReview): Promise<Review> {
    const { data, error } = await this.db.from("reviews").insert({ user_id: input.userId, booking_code: input.bookingCode, name: input.name, stars: input.stars, text: input.text, date: input.date, approved: input.approved }).select("*").single();
    if (error) fail("createReview", error);
    return reviewFromRow(data as ReviewRow);
  }
  async updateReview(id: string, patch: Partial<Review>): Promise<Review> {
    const row: Partial<ReviewRow> = {};
    if (patch.approved !== undefined) row.approved = patch.approved;
    if (patch.text !== undefined) row.text = patch.text;
    if (patch.stars !== undefined) row.stars = patch.stars;
    if (patch.name !== undefined) row.name = patch.name;
    const { data, error } = await this.db.from("reviews").update(row).eq("id", id).select("*").maybeSingle();
    if (error) fail("updateReview", error);
    if (!data) throw new NotFoundError("review");
    return reviewFromRow(data as ReviewRow);
  }
  async deleteReview(id: string): Promise<void> {
    const { error } = await this.db.from("reviews").delete().eq("id", id);
    if (error) fail("deleteReview", error);
  }

  /* ---------- profiles ---------- */
  async getProfile(id: string): Promise<Profile | null> {
    const { data, error } = await this.db.from("profiles").select("*").eq("id", id).maybeSingle();
    if (error) fail("getProfile", error);
    return data ? profileFromRow(data as ProfileRow) : null;
  }
  async upsertProfile(profile: Pick<Profile, "id" | "email"> & Partial<Profile>): Promise<Profile> {
    const row: Partial<ProfileRow> = { id: profile.id, email: profile.email };
    if (profile.fullName !== undefined) row.full_name = profile.fullName;
    if (profile.phone !== undefined) row.phone = profile.phone;
    if (profile.company !== undefined) row.company = profile.company;
    if (profile.truck !== undefined) row.truck = profile.truck;
    if (profile.plate !== undefined) row.plate = profile.plate;
    if (profile.role !== undefined) row.role = profile.role;
    const { data, error } = await this.db.from("profiles").upsert(row, { onConflict: "id" }).select("*").single();
    if (error) fail("upsertProfile", error);
    return profileFromRow(data as ProfileRow);
  }

  /* ---------- audit ---------- */
  async appendAudit(entry: NewAuditEntry): Promise<AuditEntry> {
    const { data, error } = await this.db.from("audit_log").insert({ actor: entry.actor, action: entry.action, target: entry.target, meta: entry.meta }).select("*").single();
    if (error) fail("appendAudit", error);
    return auditFromRow(data as AuditRow);
  }
  async listAudit(limit = 100): Promise<AuditEntry[]> {
    const { data, error } = await this.db.from("audit_log").select("*").order("at", { ascending: false }).limit(limit);
    if (error) fail("listAudit", error);
    return (data as AuditRow[]).map(auditFromRow);
  }

  async clearOperationalData(): Promise<void> {
    for (const table of ["member_payments", "members", "bookings", "reviews", "audit_log"]) {
      const { error } = await this.db.from(table).delete().not("id", "is", null);
      if (error) fail(`clear ${table}`, error);
    }
  }
}
