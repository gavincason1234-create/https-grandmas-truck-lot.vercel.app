import type { LotSettings, PrivateSettings } from "./types";

/** Starting settings. The owner changes all of these from /admin/settings. */
export const DEFAULT_SETTINGS: LotSettings = {
  lotName: "Grandma's Truck Lot",
  address: "2905–2973 FM-1198, Gainesville, TX 76240",
  truckDirections:
    "From I-35 take exit 498B for US-82 West toward Gainesville. Stay on US-82 about 5 miles, then turn onto FM-1198. The lot is on the right — look for the lit gate and the amber sign. Approach from US-82, not from the county roads to the south: those have a low bridge and no room to turn a 53' around.",
  lat: 33.6259,
  lng: -97.2211,
  phone: "(940) 555-0100",
  smsPhone: "",
  spots: 15,
  nightlyCents: 1000,
  monthlyCents: 12500,
  showerCents: 1000,
  laundryCents: 500,
  nightlyExtras: true,
  notes:
    "Gravel lot, pull-through. Enter the gate code at either keypad — mounted at cab height. Park in any open stall. Porta-potties by the shed.",
  policy:
    "Nightly: full refund if cancelled before 6 PM on arrival day. Monthly: cancel any time, no refund for the current month.",
  security: { lit: true, gated: true, cameras: false, fenced: true },
  overhead: [
    { name: "Porta-potties + lot maintenance", amountCents: 25000 },
    { name: "Trash dumpster", amountCents: 8000 },
    { name: "Liability insurance (estimate)", amountCents: 10000 },
  ],
  photos: [
    { src: "", caption: "Entrance from US-82" },
    { src: "", caption: "Lot at night" },
    { src: "", caption: "Shower + laundry shed" },
    { src: "", caption: "Gate keypad, cab height" },
  ],
  backgroundUrl: "",
  maxLengthFt: 75,
  testMode: true,
};

export const DEFAULT_PRIVATE: PrivateSettings = {
  gate1: "4471",
  gate2: "4471",
  shedCode: "8820",
};

/** Merge a possibly-partial stored record over the defaults so new fields never come back undefined. */
export function withDefaults(partial: Partial<LotSettings> | null | undefined): LotSettings {
  const p = partial ?? {};
  return {
    ...DEFAULT_SETTINGS,
    ...p,
    security: { ...DEFAULT_SETTINGS.security, ...(p.security ?? {}) },
    overhead: Array.isArray(p.overhead) ? p.overhead : DEFAULT_SETTINGS.overhead,
    photos: Array.isArray(p.photos) ? p.photos : DEFAULT_SETTINGS.photos,
  };
}

/** What a driver's browser may know. The owner's overhead numbers are hers alone. */
export type PublicSettings = Omit<LotSettings, "overhead">;

export function publicSettings(s: LotSettings): PublicSettings {
  const { overhead: _overhead, ...rest } = s;
  void _overhead;
  return rest;
}
