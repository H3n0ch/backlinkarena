"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { addManualSponsorship, previewSponsorLogo, toggleSponsorship } from "@/app/actions/sponsor";
import { SponsorCard } from "@/components/SponsorCard";
import { SPONSOR_AMOUNT_CENTS, SPONSOR_LIMITS } from "@/lib/sponsor-offer";
import { Switch } from "./Switch";

type Method = "card" | "wire" | "free";

/**
 * Admin: build a sponsor banner, see exactly how it looks, then flip the switch to put it live
 * (saved as paid + approved for the picked tournament). Flip it off again to pause it.
 */
export function SponsorPreview({ tournaments }: { tournaments: { id: string; name: string }[] }) {
  const router = useRouter();
  const [brand, setBrand] = useState("EasySite AI");
  const [tagline, setTagline] = useState("Launch a beautiful website in minutes with AI.");
  const [website, setWebsite] = useState("ezsite.ai");
  const [logo, setLogo] = useState("https://cdn.ezsite.ai/autodevweb/release/apple-touch-icon.png");
  const [email, setEmail] = useState("");
  const [method, setMethod] = useState<Method>("wire");
  const [amount, setAmount] = useState(String(SPONSOR_AMOUNT_CENTS / 100));
  const [tournamentId, setTournamentId] = useState(tournaments[0]?.id ?? "");
  const [empty, setEmpty] = useState(false);

  /** Set once activated: the switch then pauses / resumes this sponsorship. */
  const [savedId, setSavedId] = useState<string | null>(null);
  const [live, setLive] = useState(false);
  const [liveTournament, setLiveTournament] = useState<string | null>(null);
  const [busy, start] = useTransition();
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);

  const logoUrl = /^https?:\/\//i.test(logo.trim()) ? logo.trim() : null;
  const tournamentName = savedId ? liveTournament : (tournaments.find((t) => t.id === tournamentId)?.name ?? null);

  const findLogo = () =>
    start(async () => {
      setMsg(null);
      const r = await previewSponsorLogo(website);
      if (r.ok && r.data) setLogo(r.data);
      else setMsg({ ok: false, text: r.ok ? "No logo found." : r.error });
    });

  const flip = (next: boolean) =>
    start(async () => {
      setMsg(null);
      if (savedId) {
        // Already saved: the switch pauses / resumes it.
        const r = await toggleSponsorship(savedId);
        if (r.ok) setLive(next);
        setMsg(r.ok ? { ok: true, text: next ? "Live on the site again." : "Paused: hidden from visitors." } : { ok: false, text: r.error });
        router.refresh();
        return;
      }
      if (!next) return;
      if (!tournamentId) return setMsg({ ok: false, text: "No open tournament without a sponsor." });
      if (!email.trim()) return setMsg({ ok: false, text: "Add the sponsor's email first." });
      if (!confirm(`Put ${brand || "this sponsor"} live on backlinkarena.com for ${tournamentName}?`)) return;

      const fd = new FormData();
      fd.set("brandName", brand);
      fd.set("website", website);
      fd.set("tagline", tagline);
      fd.set("logoUrl", logo);
      fd.set("email", email);
      fd.set("method", method);
      fd.set("amount", method === "free" ? "0" : amount);
      fd.set("tournamentId", tournamentId);
      const r = await addManualSponsorship(fd);
      if (r.ok && r.data) {
        setSavedId(r.data);
        setLiveTournament(tournamentName);
        setLive(true);
      }
      setMsg(r.ok ? { ok: true, text: r.message ?? "Live on the site." } : { ok: false, text: r.error });
      router.refresh();
    });

  /** Editing after activation would only change the preview, not the live sponsor. */
  const locked = Boolean(savedId);

  return (
    <section className="card mt-6 p-5">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h2 className="font-display text-2xl font-extrabold">Sponsor banner</h2>
          <p className="text-sm text-muted">
            Fill it in, check the preview, then switch it on. Paid by card, wire or free: you approve it here.
          </p>
        </div>
        <div className="flex items-center gap-3 rounded-xl border border-line bg-card px-3 py-2">
          <span className="text-sm font-bold">{live ? "Live" : savedId ? "Paused" : "Off"}</span>
          <Switch on={live} onChange={flip} disabled={busy || empty} label="Sponsor live on the site" />
        </div>
      </div>

      <div className="mt-4 grid gap-3 sm:grid-cols-2">
        <label className="flex flex-col gap-1 text-sm font-semibold">
          Brand
          <input className="field" value={brand} disabled={locked} maxLength={SPONSOR_LIMITS.brandName} onChange={(e) => setBrand(e.target.value)} />
        </label>
        <label className="flex flex-col gap-1 text-sm font-semibold">
          Pitch
          <input className="field" value={tagline} disabled={locked} maxLength={SPONSOR_LIMITS.tagline} onChange={(e) => setTagline(e.target.value)} />
        </label>
        <label className="flex flex-col gap-1 text-sm font-semibold">
          Website
          <span className="flex gap-2">
            <input className="field min-w-0 flex-1" value={website} disabled={locked} onChange={(e) => setWebsite(e.target.value)} />
            <button type="button" className="btn bg-card text-xs" disabled={busy || locked} onClick={findLogo}>
              Get logo from website
            </button>
          </span>
        </label>
        <label className="flex flex-col gap-1 text-sm font-semibold">
          Logo URL
          <input className="field" value={logo} disabled={locked} placeholder="https://…/logo.png" onChange={(e) => setLogo(e.target.value)} />
        </label>
        <label className="flex flex-col gap-1 text-sm font-semibold">
          Sponsor email
          <input className="field" type="email" value={email} disabled={locked} onChange={(e) => setEmail(e.target.value)} />
        </label>
        <div className="grid grid-cols-2 gap-3">
          <label className="flex flex-col gap-1 text-sm font-semibold">
            Paid by
            <select className="field" value={method} disabled={locked} onChange={(e) => setMethod(e.target.value as Method)}>
              <option value="wire">Wire</option>
              <option value="card">Card</option>
              <option value="free">Free</option>
            </select>
          </label>
          <label className="flex flex-col gap-1 text-sm font-semibold">
            Amount (USD)
            <input
              className="field"
              type="number"
              min={0}
              step="0.01"
              value={method === "free" ? "0" : amount}
              disabled={locked || method === "free"}
              onChange={(e) => setAmount(e.target.value)}
            />
          </label>
        </div>
        <label className="flex flex-col gap-1 text-sm font-semibold sm:col-span-2">
          Tournament
          {tournaments.length ? (
            <select className="field" value={tournamentId} disabled={locked} onChange={(e) => setTournamentId(e.target.value)}>
              {tournaments.map((t) => (
                <option key={t.id} value={t.id}>
                  {t.name}
                </option>
              ))}
            </select>
          ) : (
            <span className="text-sm font-normal text-muted">Every open tournament already has a sponsor.</span>
          )}
        </label>
      </div>

      <div className="mt-3 flex flex-wrap items-center justify-between gap-3">
        <label className="flex items-center gap-2 text-sm">
          <input type="checkbox" checked={empty} onChange={(e) => setEmpty(e.target.checked)} />
          Show the &quot;slot open&quot; version instead
        </label>
        {locked && (
          <button
            type="button"
            className="text-sm font-semibold underline"
            onClick={() => {
              setSavedId(null);
              setLive(false);
              setMsg(null);
              setTournamentId(tournaments[0]?.id ?? "");
            }}
          >
            Start a new sponsor
          </button>
        )}
      </div>
      {msg && <p className={`mt-3 text-sm font-semibold ${msg.ok ? "text-mint" : "text-red-dark"}`}>{msg.text}</p>}

      <div className="mt-6 rounded-2xl bg-cream py-6">
        <SponsorCard
          sponsor={
            empty
              ? null
              : { id: "preview", brand_name: brand || "Brand", tagline: tagline || "Your pitch", logo_url: logoUrl, website: "https://example.com" }
          }
          tournamentName={tournamentName}
        />
      </div>
    </section>
  );
}
