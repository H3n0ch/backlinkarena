import Image from "next/image";
import Link from "next/link";
import { LeadButton } from "@/components/LeadButton";
import { hasFixedPrice, SERVICES, type Service } from "@/lib/services";

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

/** `page`: rendered as the /services page (H1, search-focused copy). Default: homepage section. */
export function Services({ page = false }: { page?: boolean }) {
  const Heading = page ? "h1" : "h2";
  return (
    <section id="services" className={`mx-auto max-w-5xl scroll-mt-20 px-4 ${page ? "pt-12 sm:pt-16" : "mt-24"}`}>
      <p className="text-gradient mx-auto w-fit text-center text-xs font-bold uppercase tracking-widest">Our service</p>
      <Heading className="headline mt-2 text-center text-4xl sm:text-5xl">
        {page ? "Buy high DA backlinks " : "Backlinks "}that <span className="text-gradient">actually count</span>
      </Heading>
      <p className="mx-auto mt-3 max-w-xl text-center text-muted">
        {page
          ? "Do-follow links in real content on relevant sites in your niche, placed through manual outreach. No PBNs and no link farms."
          : "The arena is how you meet us. Placing your links is what we do: real content on relevant sites in your niche, no PBNs and no link farms."}
      </p>

      <div className="mt-10 grid gap-4 md:grid-cols-2">
        {SERVICES.map((s) => {
          // Dark cards swap the muted grey for translucent white so text stays readable.
          const muted = s.dark ? "text-white/70" : "text-muted";
          return (
          <article
            key={s.id}
            className={`relative flex flex-col overflow-hidden rounded-[0.875rem] p-6 ${
              s.dark
                ? "bg-dark-gradient text-white shadow-[0_24px_60px_-24px_rgb(234_88_12/0.6)] ring-1 ring-white/10"
                : s.featured
                  ? "border-gradient"
                  : "card"
            }`}
          >
            {s.dark && <span aria-hidden="true" className="line-gradient absolute inset-x-0 top-0" />}
            <div className="flex items-start justify-between gap-3">
              <h3 className={`headline text-2xl ${s.featured ? "text-gradient" : ""}`}>{s.name}</h3>
              {s.icon && (
                <Image
                  src={s.icon.src}
                  width={s.icon.width}
                  height={s.icon.height}
                  alt={s.icon.alt}
                  className="-mt-2 h-12 w-auto shrink-0"
                />
              )}
            </div>
            <p className={`mt-1 text-sm ${muted}`}>{s.tagline}</p>

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
                {s.price && hasFixedPrice(s.price) && (
                  <span className={`mr-1 block text-sm font-semibold ${muted}`}>Starts at</span>
                )}
                {s.price} <span className={`text-sm font-semibold ${muted}`}>{s.priceUnit}</span>
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

            {s.image && (
              <Image
                src={s.image.src}
                width={s.image.width}
                height={s.image.height}
                alt={s.image.alt}
                sizes="(min-width: 768px) 480px, 100vw"
                className={`mt-5 h-auto w-full rounded-xl ring-1 ${s.dark ? "ring-white/10" : "ring-line"}`}
              />
            )}

            <LeadButton
              label={`${s.cta} →`}
              service={defaultOption(s)}
              className={`btn mt-6 ${
                s.dark
                  ? "border-transparent bg-[image:var(--grad-brand)] text-white shadow-[0_10px_24px_-10px_rgb(234_88_12/0.8)] hover:brightness-110"
                  : s.featured
                    ? "border-red bg-red text-white"
                    : "bg-card"
              }`}
            />
          </article>
          );
        })}
      </div>

      <p className="mx-auto mt-6 max-w-xl rounded-xl bg-soft-gradient px-4 py-3 text-center text-sm ring-1 ring-red/15">
        Prices depend on your industry and the sites you choose.{" "}
        <strong className="text-red-dark">Played in the arena?</strong> Your participant price (30% off) is waiting in{" "}
        <Link href="/dashboard" className="font-semibold underline">
          your dashboard
        </Link>
        .
      </p>
      {!page && (
        <p className="mt-4 text-center text-sm">
          <Link href="/services" className="font-semibold text-red-dark hover:underline">
            How our link building works →
          </Link>
        </p>
      )}
    </section>
  );
}
