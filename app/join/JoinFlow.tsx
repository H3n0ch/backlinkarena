"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { useEffect, useRef, useState, useTransition } from "react";
import { createProduct, previewSite, type SitePreview } from "@/app/actions/join";
import { ProductLogo } from "@/components/ProductLogo";

const DRAFT_KEY = "ba:join-draft";

type Draft = SitePreview & { category: string };

// localStorage, not sessionStorage: the magic link usually opens in a NEW tab, which has
// its own empty sessionStorage. Drafts expire after 2 hours.
const DRAFT_TTL_MS = 2 * 3600_000;

function readDraft(): Draft | null {
  try {
    const raw = localStorage.getItem(DRAFT_KEY);
    if (!raw) return null;
    const { draft, savedAt } = JSON.parse(raw) as { draft: Draft; savedAt: number };
    if (!draft || Date.now() - savedAt > DRAFT_TTL_MS) {
      localStorage.removeItem(DRAFT_KEY);
      return null;
    }
    return draft;
  } catch {
    return null;
  }
}

function writeDraft(draft: Draft) {
  try {
    localStorage.setItem(DRAFT_KEY, JSON.stringify({ draft, savedAt: Date.now() }));
  } catch {}
}

function clearDraft() {
  try {
    localStorage.removeItem(DRAFT_KEY);
  } catch {}
}

export function JoinFlow() {
  const params = useSearchParams();
  const router = useRouter();
  const [url, setUrl] = useState(params.get("url") ?? "");
  const [draft, setDraft] = useState<Draft | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [pending, start] = useTransition();
  const autoRan = useRef(false);
  // Path picked on the pricing card (badge / pass), carried through login to the dashboard.
  const planParam = params.get("plan");
  const plan = planParam === "badge" || planParam === "pass" ? planParam : null;
  const planQuery = plan ? `&plan=${plan}` : "";

  function preview(target: string) {
    setError(null);
    start(async () => {
      const r = await previewSite(target);
      if (r.ok && r.data) setDraft({ ...r.data, category: "" });
      else if (!r.ok) setError(r.error);
    });
  }

  // Resume after login, or auto-preview a URL passed from the landing page.
  useEffect(() => {
    // Guard inside the timer: in dev, Strict Mode runs this effect twice and the cleanup
    // cancels the first timer, so marking "ran" up front would skip the resume entirely.
    const t = setTimeout(() => {
      if (autoRan.current) return;
      autoRan.current = true;
      const saved = params.get("resume") ? readDraft() : null;
      const initial = params.get("url");
      if (saved) {
        // Back from login: show the draft and finish saving it without another click.
        setDraft(saved);
        save(saved, true);
      } else if (initial) preview(initial);
      else if (params.get("resume")) {
        setError("You're logged in. We couldn't find the site you entered (it may have expired), so please add it once more.");
      }
    }, 0);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function save(d: Draft | null = draft, resumed = false) {
    if (!d) return;
    setError(null);
    start(async () => {
      const r = await createProduct({
        url: d.url,
        name: d.name,
        description: d.description,
        logoUrl: d.logoUrl ?? "",
        category: d.category,
      });
      if (r.ok && r.data) {
        clearDraft();
        router.push(`/dashboard?joined=${r.data.slug}${planQuery}`);
      } else if (!r.ok && r.error === "Please log in first.") {
        // Auto-resume without a session (link opened on another device): let them retry by hand.
        if (resumed) return;
        writeDraft(d);
        router.push(`/login?next=${encodeURIComponent(`/join?resume=1${planQuery}`)}`);
      } else if (!r.ok) {
        setError(r.error);
      }
    });
  }

  if (!draft) {
    return (
      <form
        className="card mt-6 flex flex-col gap-3 p-5"
        onSubmit={(e) => {
          e.preventDefault();
          preview(url);
        }}
      >
        <label htmlFor="url" className="font-bold">
          Your website
        </label>
        <input
          id="url"
          className="field"
          placeholder="yourproduct.com"
          inputMode="url"
          value={url}
          onChange={(e) => setUrl(e.target.value)}
          required
        />
        <button className="btn bg-red text-white" disabled={pending}>
          {pending ? "Fetching your site…" : "Continue"}
        </button>
        {error && <p className="text-sm font-semibold text-red">{error}</p>}
      </form>
    );
  }

  return (
    <div className="card mt-6 flex flex-col gap-4 p-5">
      <div className="flex items-center gap-3">
        <ProductLogo src={draft.logoUrl} name={draft.name || draft.domain} size={64} />
        <div className="min-w-0">
          <p className="text-xs font-semibold uppercase tracking-wide text-muted">Looks right?</p>
          <p className="truncate font-display text-xl font-extrabold">{draft.domain}</p>
        </div>
      </div>

      <label className="flex flex-col gap-1 text-sm font-semibold">
        Name
        <input
          className="field"
          value={draft.name}
          maxLength={80}
          onChange={(e) => setDraft({ ...draft, name: e.target.value })}
          required
        />
      </label>
      <label className="flex flex-col gap-1 text-sm font-semibold">
        Short description
        <textarea
          className="field min-h-24"
          value={draft.description}
          maxLength={300}
          onChange={(e) => setDraft({ ...draft, description: e.target.value })}
        />
      </label>
      <label className="flex flex-col gap-1 text-sm font-semibold">
        Category / niche
        <input
          className="field"
          placeholder="e.g. Marketing SaaS, Real estate, Fitness"
          value={draft.category}
          maxLength={60}
          onChange={(e) => setDraft({ ...draft, category: e.target.value })}
        />
        <span className="text-xs font-normal text-muted">
          Helps us find a good round-1 matchup for you. Never a direct competitor.
        </span>
      </label>
      <label className="flex flex-col gap-1 text-sm font-semibold">
        Logo URL
        <input
          className="field"
          value={draft.logoUrl ?? ""}
          maxLength={1000}
          onChange={(e) => setDraft({ ...draft, logoUrl: e.target.value })}
        />
      </label>

      <div className="flex flex-col gap-2 sm:flex-row">
        <button className="btn flex-1 bg-red text-white" onClick={() => save()} disabled={pending || !draft.name.trim()}>
          {pending ? "Saving…" : "Enter the arena"}
        </button>
        <button className="btn bg-card" onClick={() => setDraft(null)} disabled={pending}>
          Change URL
        </button>
      </div>
      {error && <p className="text-sm font-semibold text-red">{error}</p>}
    </div>
  );
}
