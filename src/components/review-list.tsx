import Link from "next/link";
import { prettyDay } from "@/lib/dates";
import type { Review } from "@/lib/types";
import { Card, Empty } from "./ui/card";

/** ★★★★☆ in the accent colour, with a readable label for screen readers. */
export function Stars({ stars, size = "md", className = "" }: { stars: number; size?: "sm" | "md" | "lg"; className?: string }) {
  const n = Math.max(0, Math.min(5, Math.round(stars)));
  const cls = size === "lg" ? "text-[30px]" : size === "sm" ? "text-[14px]" : "text-[19px]";
  return (
    <span className={`text-accent tracking-[0.06em] leading-none whitespace-nowrap ${cls} ${className}`} role="img" aria-label={`${n} out of 5 stars`}>
      {"★".repeat(n)}
      {"☆".repeat(5 - n)}
    </span>
  );
}

/** Mean star rating, or null when there is nothing to average. */
export function averageStars(reviews: readonly Pick<Review, "stars">[]): number | null {
  if (!reviews.length) return null;
  return reviews.reduce((sum, r) => sum + r.stars, 0) / reviews.length;
}

/** "4.6 · 12 reviews" — the summary line used on the home page and the reviews page. */
export function ReviewSummary({ reviews, size = "md" }: { reviews: readonly Pick<Review, "stars">[]; size?: "md" | "lg" }) {
  const avg = averageStars(reviews);
  if (avg === null) return null;
  const big = size === "lg";
  return (
    <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
      <Stars stars={avg} size={big ? "lg" : "md"} />
      <span className={`num font-extrabold ${big ? "text-[28px]" : "text-[18px]"}`}>{avg.toFixed(1)}</span>
      <span className="text-muted text-[14px]">
        {reviews.length} review{reviews.length === 1 ? "" : "s"}
      </span>
    </div>
  );
}

/** Approved reviews, newest first. Pass the already-filtered list in. */
export function ReviewList({ reviews }: { reviews: Review[] }) {
  if (!reviews.length) {
    return (
      <Empty>
        No reviews yet. Parked here?{" "}
        <Link href="/reviews#leave-a-review" className="font-bold text-fg">
          Be the first to leave one.
        </Link>
      </Empty>
    );
  }
  return (
    <ul className="list-none m-0 p-0 grid gap-2.5">
      {reviews.map((r) => (
        <li key={r.id}>
          <Card>
            <Stars stars={r.stars} />
            <p className="mt-2 mb-2 text-[15px] leading-relaxed whitespace-pre-line">{r.text}</p>
            <div className="text-[12.5px] text-muted">
              <span className="font-semibold text-fg">{r.name}</span> · {prettyDay(r.date)}
            </div>
          </Card>
        </li>
      ))}
    </ul>
  );
}
