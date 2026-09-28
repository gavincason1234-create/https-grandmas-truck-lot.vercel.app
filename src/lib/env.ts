/**
 * One place that reads process.env. Everything else asks this module.
 * Nothing here is imported by client components except through NEXT_PUBLIC_* values.
 */

export type StoreMode = "supabase" | "memory";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL?.trim() || "";
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY?.trim() || "";
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY?.trim() || "";

const isVercelProduction = process.env.VERCEL_ENV === "production";

const requestedMemory = process.env.LOT_STORE === "memory";
const canUseSupabase = Boolean(supabaseUrl && supabaseAnonKey);

/**
 * Memory mode is for local development and automated tests: everything lives in
 * the server process and vanishes on restart. It is refused on Vercel production.
 */
const storeMode: StoreMode = requestedMemory && !isVercelProduction ? "memory" : canUseSupabase ? "supabase" : "memory";

/**
 * A live Vercel production deployment with no database. The site still renders so the owner can
 * look at it, but it must not accept reservations it could never keep.
 */
const notConfigured = isVercelProduction && storeMode === "memory";

export const env = {
  storeMode,
  notConfigured,
  isVercelProduction,
  nodeEnv: process.env.NODE_ENV ?? "development",
  supabase: {
    url: supabaseUrl,
    anonKey: supabaseAnonKey,
    serviceRoleKey,
    /** Server can write to the database. */
    canWrite: Boolean(supabaseUrl && serviceRoleKey),
  },
  siteUrl: (
    process.env.NEXT_PUBLIC_SITE_URL?.trim() ||
    // The project's stable production domain, not the per-deployment one Google would reject.
    (process.env.VERCEL_PROJECT_PRODUCTION_URL ? `https://${process.env.VERCEL_PROJECT_PRODUCTION_URL}` : "") ||
    (process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : "http://localhost:3000")
  ).replace(/\/$/, ""),
  stripe: {
    secretKey: process.env.STRIPE_SECRET_KEY?.trim() || "",
    webhookSecret: process.env.STRIPE_WEBHOOK_SECRET?.trim() || "",
    publishableKey: process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY?.trim() || "",
    get enabled() {
      return Boolean(this.secretKey);
    },
  },
  /** Fake sign-in buttons on /login. Only in memory mode, never on Vercel production. */
  /** Never on Vercel at all — a preview with missing env vars must not hand out a fake owner login. */
  devAuth: storeMode === "memory" && !process.env.VERCEL,
  devAuthSecret: process.env.DEV_AUTH_SECRET?.trim() || "grandmas-truck-lot-dev-only",
  /** Vercel Cron sends this as `Authorization: Bearer <secret>`; empty means the cron route is open. */
  cronSecret: process.env.CRON_SECRET?.trim() || "",
};

export type Env = typeof env;
