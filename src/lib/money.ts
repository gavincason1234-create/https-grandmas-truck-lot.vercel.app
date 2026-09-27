/** Format whole cents as "$1,234" or "$12.50" — whole dollars stay whole so prices read like a sign. */
export function money(cents: number): string {
  const sign = cents < 0 ? "−" : "";
  const abs = Math.abs(Math.round(cents));
  const dollars = Math.floor(abs / 100);
  const rem = abs % 100;
  const base = dollars.toLocaleString("en-US");
  return rem === 0 ? `${sign}$${base}` : `${sign}$${base}.${String(rem).padStart(2, "0")}`;
}

/** Parse a user-typed dollar amount ("12", "12.5", "$1,250.00") into cents. Returns null when unusable. */
export function parseDollars(input: string | number | null | undefined): number | null {
  if (typeof input === "number") return Number.isFinite(input) ? Math.round(input * 100) : null;
  if (!input) return null;
  const cleaned = String(input).replace(/[$,\s]/g, "");
  if (!/^-?\d*(\.\d{0,2})?$/.test(cleaned) || cleaned === "" || cleaned === "-") return null;
  return Math.round(parseFloat(cleaned) * 100);
}

export function centsToDollarString(cents: number): string {
  return (cents / 100).toFixed(cents % 100 === 0 ? 0 : 2);
}
