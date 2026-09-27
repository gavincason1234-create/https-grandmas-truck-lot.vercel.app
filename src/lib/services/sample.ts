import "server-only";
import { addDays, addMonths, todayStr } from "../dates";
import { env } from "../env";
import { getStore } from "../store";

/** Pretend bookings for trying the dashboard. Loaded from the owner's settings page or the test harness. */
export class SampleDataRefused extends Error {}

/** True when pretend bookings would sit next to real ones. */
export function sampleDataAllowed(): boolean {
  return !(env.isVercelProduction && getStore().kind === "supabase");
}

export async function loadSampleData(): Promise<void> {
  if (!sampleDataAllowed()) throw new SampleDataRefused("Sample bookings are for trying things out, not the live lot.");
  const store = getStore();
  const s = await store.getSettings();
  const t = todayStr();

  await store.createBooking({ userId: null, name: "Dale Whitaker", phone: "(940) 555-0142", company: "Owner-operator", truck: "53' dry van", plate: "TX 8421RM", arrive: t, nights: 1, extras: { showers: 1, loads: 0 }, amountCents: s.nightlyCents + s.showerCents, paid: true, status: "reserved", paymentRef: null });
  await store.createBooking({ userId: null, name: "Marisol Ortega", phone: "(214) 555-0177", company: "Ortega Transport", truck: "Reefer", plate: "TX 3390LK", arrive: addDays(t, -1), nights: 2, extras: { showers: 0, loads: 1 }, amountCents: s.nightlyCents * 2 + s.laundryCents, paid: true, status: "parked", paymentRef: null });
  await store.createBooking({ userId: null, name: "Curtis Bell", phone: "(405) 555-0111", company: "", truck: "Flatbed", plate: "OK 771PZ", arrive: addDays(t, 2), nights: 1, extras: { showers: 0, loads: 0 }, amountCents: s.nightlyCents, paid: true, status: "reserved", paymentRef: null });
  await store.createBooking({ userId: null, name: "Tommy Reyes", phone: "(903) 555-0190", company: "Reyes Livestock", truck: "Cattle pot", plate: "TX 6612RL", arrive: addDays(t, -3), nights: 1, extras: { showers: 0, loads: 0 }, amountCents: s.nightlyCents, paid: false, status: "parked", paymentRef: null });

  const ray = await store.createMember({ userId: null, name: "Ray Fleitman", phone: "(940) 555-0128", company: "Fleitman Hay & Cattle", truck: "Peterbilt 389 + livestock", plate: "TX 5507HC", started: addMonths(t, -2), nextBill: addMonths(t, 1), amountCents: s.monthlyCents, status: "active", ended: null, paymentRef: null });
  await store.addMemberPayment({ memberId: ray.id, date: addMonths(t, -2), amountCents: s.monthlyCents, note: "First month" });
  await store.addMemberPayment({ memberId: ray.id, date: addMonths(t, -1), amountCents: s.monthlyCents, note: "Monthly charge" });
  await store.addMemberPayment({ memberId: ray.id, date: t, amountCents: s.monthlyCents, note: "Monthly charge" });

  const angela = await store.createMember({ userId: null, name: "Angela Hess", phone: "(940) 555-0165", company: "Owner-operator", truck: "Freightliner Cascadia", plate: "TX 2284AH", started: addMonths(t, -1), nextBill: addDays(t, -3), amountCents: s.monthlyCents, status: "past_due", ended: null, paymentRef: null });
  await store.addMemberPayment({ memberId: angela.id, date: addMonths(t, -1), amountCents: s.monthlyCents, note: "First month" });

  await store.createReview({ userId: null, bookingCode: "H2WZ6", name: "Ray · Fleitman Hay & Cattle", stars: 5, text: "Finally somewhere to keep the truck that isn't the side of the road. Gate code worked first try, shower is clean.", date: addDays(t, -6), approved: true });
  await store.createReview({ userId: null, bookingCode: "R3XQ9", name: "Marisol · Ortega Transport", stars: 4, text: "Easy pull-through, well lit. It's a ways off 35 so plan for it, but the price is right and nobody bothers you.", date: addDays(t, -2), approved: true });
  await store.createReview({ userId: null, bookingCode: null, name: "Anonymous", stars: 2, text: "Porta-potty was out of paper.", date: addDays(t, -1), approved: false });
}
