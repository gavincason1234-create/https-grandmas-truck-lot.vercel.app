import { beforeEach, describe, expect, it } from "vitest";
import { MemoryStore } from "./memory";

let store: MemoryStore;
const base = { userId: null, name: "Dale", phone: "(940) 555-0142", company: "", truck: "53' dry van", plate: "TX 8421RM", extras: { showers: 0, loads: 0 }, amountCents: 1000, paid: true, status: "reserved" as const, paymentRef: null };

describe("MemoryStore", () => {
  beforeEach(() => {
    store = new MemoryStore();
  });

  it("creates bookings with unique readable codes", async () => {
    const a = await store.createBooking({ ...base, arrive: "2026-10-01", nights: 1 });
    const b = await store.createBooking({ ...base, arrive: "2026-10-01", nights: 1 });
    expect(a.code).not.toBe(b.code);
    expect(await store.getBookingByCode(a.code)).toMatchObject({ id: a.id });
  });

  it("filters bookings by the days they cover", async () => {
    await store.createBooking({ ...base, arrive: "2026-10-01", nights: 3 }); // covers 1,2,3
    await store.createBooking({ ...base, arrive: "2026-10-10", nights: 1 });
    const hits = await store.listBookings({ from: "2026-10-03", to: "2026-10-05" });
    expect(hits).toHaveLength(1);
    expect(hits[0]!.arrive).toBe("2026-10-01");
  });

  it("keeps settings partial-safe", async () => {
    const s = await store.saveSettings({ spots: 20 });
    expect(s.spots).toBe(20);
    expect(s.lotName).toBe("Grandma's Truck Lot");
    expect(s.security.gated).toBe(true);
  });

  it("returns copies, not live references", async () => {
    const s1 = await store.getSettings();
    s1.spots = 1;
    expect((await store.getSettings()).spots).toBe(15);
  });

  it("clears operational data but not settings", async () => {
    await store.saveSettings({ spots: 7 });
    await store.createBooking({ ...base, arrive: "2026-10-01", nights: 1 });
    await store.clearOperationalData();
    expect(await store.listBookings()).toHaveLength(0);
    expect((await store.getSettings()).spots).toBe(7);
  });
});
