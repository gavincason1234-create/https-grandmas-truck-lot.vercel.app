import type { Metadata } from "next";
import Link from "next/link";
import { PageShell } from "@/components/page-shell";
import { ReviewForm } from "@/components/review-form";
import { ReviewList, ReviewSummary } from "@/components/review-list";
import { Note, Panel, SectionTitle } from "@/components/ui/card";
import { getSessionUser } from "@/lib/auth/session";
import { normalizeCode } from "@/lib/codes";
import { getStore } from "@/lib/store";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Reviews",
  description: "What drivers say about parking at Grandma's Truck Lot in Gainesville, TX, and where to leave your own review.",
};

export default async function ReviewsPage({ searchParams }: { searchParams: Promise<{ code?: string }> }) {
  const sp = await searchParams;
  const [reviews, user] = await Promise.all([getStore().listReviews({ approvedOnly: true }), getSessionUser()]);
  const defaultCode = sp.code ? normalizeCode(sp.code).slice(0, 12) : "";

  return (
    <PageShell reserveHref="/book">
      <section className="pt-7 sm:pt-10">
        <h1 className="m-0 text-[30px] sm:text-[38px] font-extrabold tracking-tight leading-[1.05]">Reviews</h1>
        <p className="mt-2 mb-0 text-[16.5px] text-muted leading-relaxed max-w-prose">Straight from drivers who parked here. The owner only holds back reviews she can&apos;t tie to a stay until she&apos;s had a look.</p>
      </section>

      <section className="mt-6">
        {reviews.length ? (
          <div className="mb-4">
            <ReviewSummary reviews={reviews} size="lg" />
          </div>
        ) : null}
        <ReviewList reviews={reviews} />
      </section>

      <section className="mt-10" id="leave-a-review">
        <SectionTitle>Leave a review</SectionTitle>
        <div className="grid gap-4 lg:grid-cols-[1fr_320px] lg:items-start">
          <Panel>
            <ReviewForm defaultName={user?.name ?? ""} defaultCode={defaultCode} />
          </Panel>
          <div className="grid gap-3">
            <Note>
              <span className="font-bold text-fg">Have your booking code? </span>
              Put it in and your review posts right away. It&apos;s the 5-letter code from your reservation — also on your{" "}
              <Link href="/find" className="font-semibold text-fg">
                booking lookup
              </Link>
              {user ? (
                <>
                  {" "}
                  and your{" "}
                  <Link href="/account" className="font-semibold text-fg">
                    account page
                  </Link>
                </>
              ) : null}
              .
            </Note>
            <Note>
              <span className="font-bold text-fg">Something wrong on the lot? </span>
              A review won&apos;t reach her at 2 AM — the phone will. Call or text from the bar below and she&apos;ll sort it out.
            </Note>
          </div>
        </div>
      </section>
    </PageShell>
  );
}
