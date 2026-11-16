import { ProductLogo } from "@/components/ProductLogo";
import { BRAND_ICONS } from "@/lib/brand-icons";
import { getTestimonials, MIN_TESTIMONIALS, type Testimonial, type TestimonialSource } from "@/lib/testimonials";

const SOURCE: Record<TestimonialSource, { label: string; color: string; d?: string }> = {
  x: { label: "X", color: "#000000", d: BRAND_ICONS.x },
  linkedin: { label: "LinkedIn", color: "#0A66C2", d: BRAND_ICONS.linkedin },
  facebook: { label: "Facebook", color: "#1877F2", d: BRAND_ICONS.facebook },
  telegram: { label: "Telegram", color: "#26A5E4", d: BRAND_ICONS.telegram },
  whatsapp: { label: "WhatsApp", color: "#25D366", d: BRAND_ICONS.whatsapp },
  email: { label: "Email", color: "#78716c" },
};

function SourceIcon({ source }: { source: TestimonialSource }) {
  const s = SOURCE[source];
  if (!s.d) {
    return (
      <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke={s.color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
        <rect x="2" y="4" width="20" height="16" rx="2" />
        <path d="m22 7-10 6L2 7" />
      </svg>
    );
  }
  return (
    <svg viewBox="0 0 24 24" width="18" height="18" fill={s.color} aria-hidden="true">
      <path d={s.d} />
    </svg>
  );
}

function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric", timeZone: "UTC" });
}

function Card({ t, hidden }: { t: Testimonial; hidden?: boolean }) {
  const s = SOURCE[t.source];
  const body = (
    <>
      <div className="flex items-start gap-3">
        <ProductLogo src={t.avatar ?? null} name={t.name} size={40} className="rounded-full! p-0!" />
        <div className="min-w-0 flex-1">
          <p className="truncate text-sm font-bold">{t.name}</p>
          {t.handle && <p className="truncate text-xs text-muted">{t.handle}</p>}
        </div>
        <SourceIcon source={t.source} />
      </div>
      <p className="mt-3 line-clamp-6 flex-1 text-sm leading-relaxed whitespace-pre-line">{t.text}</p>
      <div className="mt-4 flex items-center justify-between gap-2 border-t border-line pt-3 text-xs text-muted">
        <time dateTime={t.date}>{formatDate(t.date)}</time>
        {t.sample ? (
          <span className="rounded-full bg-sun/30 px-2 py-0.5 font-bold text-ink">Sample · dev only</span>
        ) : t.url ? (
          <span className="font-semibold group-hover/card:text-red-dark">View on {s.label} ↗</span>
        ) : (
          <span>Sent to us via {s.label}</span>
        )}
      </div>
    </>
  );
  const cls =
    "group/card card flex w-72 shrink-0 flex-col p-4 text-left transition duration-200 hover:-translate-y-0.5 sm:w-80";
  return t.url ? (
    <a href={t.url} target="_blank" rel="noopener noreferrer" className={cls} tabIndex={hidden ? -1 : undefined}>
      {body}
    </a>
  ) : (
    <div className={cls}>{body}</div>
  );
}

/* Each half of a row needs to be wider than the widest screen, or a gap shows as it loops. */
const MIN_CARDS_PER_GROUP = 8;

/**
 * One endless row. The cards are repeated until a group is wide enough, then the group is
 * rendered twice so the loop is seamless. Repeats are hidden from screen readers and keyboard.
 */
function Row({ items, reverse }: { items: Testimonial[]; reverse?: boolean }) {
  const times = Math.ceil(MIN_CARDS_PER_GROUP / items.length);
  const group = Array.from({ length: times }, () => items).flat();
  return (
    <div className="marquee" style={{ ["--marquee-duration" as string]: `${group.length * 7}s` }}>
      <div className={`marquee-track ${reverse ? "is-reverse" : ""}`}>
        {[0, 1].map((copy) => (
          <ul key={copy} className="marquee-group" aria-hidden={copy === 1 || undefined}>
            {group.map((t, i) => {
              const repeat = copy === 1 || i >= items.length;
              return (
                <li key={i} className={`flex ${repeat ? "marquee-repeat" : ""}`} aria-hidden={(repeat && copy === 0) || undefined}>
                  <Card t={t} hidden={repeat} />
                </li>
              );
            })}
          </ul>
        ))}
      </div>
    </div>
  );
}

export function WallOfLove() {
  const items = getTestimonials();
  if (items.length < MIN_TESTIMONIALS) return null;

  // Alternate posts between the two rows so neither row is all one platform.
  const top = items.filter((_, i) => i % 2 === 0);
  const bottom = items.filter((_, i) => i % 2 === 1);

  return (
    <section className="mt-24" aria-labelledby="wall-heading">
      <div className="mx-auto max-w-5xl px-4 text-center">
        <p className="text-gradient mx-auto w-fit text-xs font-bold uppercase tracking-widest">From the stands</p>
        <h2 id="wall-heading" className="headline mt-2 text-4xl sm:text-5xl">
          Founders are <span className="text-gradient">talking</span>
        </h2>
        <p className="mx-auto mt-3 max-w-lg text-muted">
          Real posts from people in the arena, on X, LinkedIn and more. Click any card to read the original.
        </p>
      </div>
      <div className="mt-10 flex flex-col gap-4">
        <Row items={top} />
        <Row items={bottom} reverse />
      </div>
    </section>
  );
}
