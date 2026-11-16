import Link from "next/link";
import { LeadButton } from "@/components/LeadButton";
import { SERVICES, type Service } from "@/lib/services";

/** Option preselected in the lead form: the "Most popular" tier, else the first. */
function defaultOption(s: Service) {
  if (!s.tiers) return s.name;
  const t = s.tiers.find((x) => x.tag === "Most popular") ?? s.tiers[0];
  return `${s.name} · ${t.title}`;
}

function Check() {
  return (
    <span className="mr-2 inline-flex h-4 w-4 shrink-0 items-center justify-center rounded-full bg-mint text-[10px] text-white">
      ✓
    </span>
  );
}

export function Services() {
  return (
    <section id="services" className="mx-auto mt-24 max-w-5xl scroll-mt-20 px-4">
      <p className="text-gradient mx-auto w-fit text-center text-xs font-bold uppercase tracking-widest">Services</p>
      <h2 className="headline mt-2 text-center text-4xl sm:text-5xl">
        Grow beyond the <span className="text-gradient">arena</span>
      </h2>
      <p className="mx-auto mt-3 max-w-xl text-center text-muted">
        Want more than one backlink? We do the outreach and get you placed on relevant websites and in the media.
      </p>

      <div className="mt-10 grid gap-4 md:grid-cols-2">
        {SERVICES.map((s) => (
          <article
            key={s.id}
            className={`flex flex-col rounded-[0.875rem] p-6 ${s.featured ? "border-gradient" : "card"}`}
          >
            <h3 className={`headline text-2xl ${s.featured ? "text-gradient" : ""}`}>{s.name}</h3>
            <p className="mt-1 text-sm text-muted">{s.tagline}</p>

            {s.tiers ? (
              <ul className="mt-5 flex flex-col divide-y divide-line rounded-xl border border-line bg-white/80">
                {s.tiers.map((t) => (
                  <li key={t.title} className="flex items-center justify-between gap-3 px-4 py-3">
                    <span className="flex items-center gap-2">
                      <span className="font-display text-2xl font-extrabold">
                        <span className="mr-1 text-xs font-semibold text-muted">from</span>
                        {t.price}
                      </span>
                      {t.tag && (
                        <span className="rounded-full bg-[image:var(--grad-brand)] px-2 py-0.5 text-[10px] font-extrabold uppercase text-white">
                          {t.tag}
                        </span>
                      )}
                    </span>
                    <span className="text-right">
                      <span className="block text-sm font-bold">{t.title}</span>
                      <span className="block text-xs text-muted">{t.detail}</span>
                    </span>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="mt-5 font-display text-4xl font-extrabold">
                <span className="mr-1 block text-sm font-semibold text-muted">Starts at</span>
                {s.price} <span className="text-sm font-semibold text-muted">{s.priceUnit}</span>
              </p>
            )}

            <ul className="mt-5 flex flex-1 flex-col gap-2 text-sm">
              {s.features.map((f) => (
                <li key={f} className="flex items-start">
                  <Check />
                  {f}
                </li>
              ))}
            </ul>

            <LeadButton
              label={`${s.cta} →`}
              service={defaultOption(s)}
              className={`btn mt-6 ${s.featured ? "border-red bg-red text-white" : "bg-card"}`}
            />
          </article>
        ))}
      </div>

      <p className="mx-auto mt-6 max-w-xl rounded-xl bg-soft-gradient px-4 py-3 text-center text-sm ring-1 ring-red/15">
        Prices depend on your industry and the sites you choose.{" "}
        <strong className="text-red-dark">Played in the arena?</strong> Your participant price (30% off) is waiting in{" "}
        <Link href="/dashboard" className="font-semibold underline">
          your dashboard
        </Link>
        .
      </p>
    </section>
  );
}
