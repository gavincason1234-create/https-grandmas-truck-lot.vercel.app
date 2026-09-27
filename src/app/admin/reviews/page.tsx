import type { Metadata } from "next";
import Link from "next/link";
import { Notice } from "@/components/admin/notice";
import { StayAction } from "@/components/admin/stay-action";
import { Stars } from "@/components/review-list";
import { Card, Empty, GroupName, Note } from "@/components/ui/card";
import { Tag } from "@/components/ui/tag";
import { requireAdmin } from "@/lib/auth/session";
import { prettyDay } from "@/lib/dates";
import { getStore } from "@/lib/store";
import type { Review } from "@/lib/types";
import { approveReview, deleteReview, hideReview } from "../actions";

export const metadata: Metadata = { title: "Reviews · Owner" };
export const dynamic = "force-dynamic";

type Search = { error?: string };

function ReviewCard({ review, children }: { review: Review; children: React.ReactNode }) {
  return (
    <Card tone={review.approved ? "ok" : "accent"} className="mb-2.5">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <Stars stars={review.stars} />
        <div className="flex flex-wrap gap-1">
          {review.bookingCode ? <Tag tone="ok">Booking {review.bookingCode}</Tag> : <Tag>No booking code</Tag>}
          <Tag tone={review.approved ? "ok" : "warn"}>{review.approved ? "Posted" : "Not posted"}</Tag>
        </div>
      </div>
      <p className="mt-2.5 mb-2 text-[15px] leading-relaxed whitespace-pre-line">{review.text}</p>
      <div className="text-[12.5px] text-muted">
        <span className="font-semibold text-fg">{review.name}</span> · {prettyDay(review.date)}
      </div>
      <div className="mt-3 flex flex-wrap gap-2 [&>*]:flex-1 [&>*]:min-w-[120px]">{children}</div>
    </Card>
  );
}

export default async function AdminReviewsPage({ searchParams }: { searchParams: Promise<Search> }) {
  await requireAdmin("/admin/reviews");
  const sp = await searchParams;
  const reviews = await getStore().listReviews();
  const waiting = reviews.filter((r) => !r.approved);
  const posted = reviews.filter((r) => r.approved);

  return (
    <div className="pt-6">
      <div className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1">
        <h1 className="m-0 text-[28px] font-extrabold tracking-tight">Reviews</h1>
        <Link href="/reviews" className="text-[14.5px] font-semibold text-muted">
          See the public page
        </Link>
      </div>

      {sp.error ? <Notice tone="warn" className="mt-4">{sp.error}</Notice> : null}

      <Note className="mt-4">
        A review with a real booking code posts on its own. Anything without one waits here until you approve it. Hiding a review takes it off the site but keeps it; deleting is for good.
      </Note>

      {reviews.length === 0 ? (
        <Empty className="mt-6">No reviews yet. Drivers can leave one from the Reviews page after a stay.</Empty>
      ) : (
        <>
          <GroupName>Waiting for approval ({waiting.length})</GroupName>
          {waiting.length === 0 ? (
            <Empty>Nothing waiting. Every review is either posted or gone.</Empty>
          ) : (
            waiting.map((r) => (
              <ReviewCard key={r.id} review={r}>
                <StayAction action={approveReview} id={r.id} variant="primary">
                  Approve
                </StayAction>
                <StayAction action={deleteReview} id={r.id} variant="danger" confirm={`Delete this ${r.stars}-star review from ${r.name} for good?`}>
                  Delete
                </StayAction>
              </ReviewCard>
            ))
          )}

          <GroupName>Posted ({posted.length})</GroupName>
          {posted.length === 0 ? (
            <Empty>Nothing is posted yet.</Empty>
          ) : (
            posted.map((r) => (
              <ReviewCard key={r.id} review={r}>
                <StayAction action={hideReview} id={r.id} variant="ghost">
                  Hide
                </StayAction>
                <StayAction action={deleteReview} id={r.id} variant="danger" confirm={`Delete this ${r.stars}-star review from ${r.name} for good?`}>
                  Delete
                </StayAction>
              </ReviewCard>
            ))
          )}
        </>
      )}
    </div>
  );
}
