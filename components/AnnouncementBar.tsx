import Link from "next/link";
import { Countdown } from "@/components/Countdown";
import { getActiveTournament, getBracket } from "@/lib/data";

/** Thin dark bar on top of every page: what's happening now + next deadline. */
export async function AnnouncementBar() {
  const t = await getActiveTournament();

  let label = "Free entry · The winner gets a DA 50+ backlink";
  let deadline: { text: string; to: string } | null = null;
  /** Short status tag in front of the label: what phase we're in. */
  let tag: string | null = null;

  if (t?.status === "qualifying" && t.qualifying_ends_at) {
    tag = "Live";
    label = `${t.name}: qualifying is live`;
    deadline = { text: "Bracket locks in", to: t.qualifying_ends_at };
  } else if (t?.status === "bracket") {
    const { matches } = await getBracket(t.id);
    const live = matches.find((m) => m.status === "open");
    tag = "Live";
    label = `${t.name}: the bracket is live`;
    if (live) deadline = { text: "Round ends in", to: live.ends_at };
  } else if (t?.status === "draft") {
    tag = "Soon";
    label = `${t.name} opens soon · Entries are open`;
  }

  if (t?.paused_at && tag === "Live") tag = "Paused";

  return (
    <div className="bg-dark-gradient text-white">
      <div className="mx-auto flex max-w-6xl flex-wrap items-center justify-center gap-x-4 gap-y-1 px-4 py-2 text-xs sm:justify-between sm:text-sm">
        <p className="font-bold">
          {tag && (
            <span className="headline text-gradient mr-2 inline-flex items-center gap-1.5">
              {tag === "Live" && <span aria-hidden="true" className="inline-block h-1.5 w-1.5 animate-pulse rounded-full bg-red" />}
              {tag}
            </span>
          )}
          {label}
        </p>
        {deadline && (
          <p className="font-semibold">
            {deadline.text}{" "}
            <span className="rounded bg-[image:var(--grad-brand)] px-1.5 py-0.5 font-mono font-bold">
              <Countdown to={deadline.to} endedText="now" pausedAt={t?.paused_at} />
            </span>
          </p>
        )}
        <Link href="/#pricing" className="hidden font-bold text-red hover:underline sm:inline">
          Skip qualifying: $79 →
        </Link>
      </div>
    </div>
  );
}
