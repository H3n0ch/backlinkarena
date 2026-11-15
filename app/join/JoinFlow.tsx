"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { useEffect, useRef, useState, useTransition } from "react";
import { createProduct, previewSite, type SitePreview } from "@/app/actions/join";
import { ProductLogo } from "@/components/ProductLogo";

const DRAFT_KEY = "ba:join-draft";

type Draft = SitePreview & { category: string };

function readDraft(): Draft | null {
  try {
    const raw = sessionStorage.getItem(DRAFT_KEY);
    return raw ? (JSON.parse(raw) as Draft) : null;
  } catch {
    return null;
  }
}

export function JoinFlow() {
  const params = useSearchParams();
  const router = useRouter();
  const [url, setUrl] = useState(params.get("url") ?? "");
  const [draft, setDraft] = useState<Draft | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [pending, start] = useTransition();
  const autoRan = useRef(false);

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
    if (autoRan.current) return;
    autoRan.current = true;
    const saved = params.get("resume") ? readDraft() : null;
    const initial = params.get("url");
    const t = setTimeout(() => {
      if (saved) setDraft(saved);
      else if (initial) preview(initial);
    }, 0);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function save() {
    if (!draft) return;
    setError(null);
    start(async () => {
      const r = await createProduct({
        url: draft.url,
        name: draft.name,
        description: draft.description,
        logoUrl: draft.logoUrl ?? "",
        category: draft.category,
      });
      if (r.ok && r.data) {
        try {
          sessionStorage.removeItem(DRAFT_KEY);
        } catch {}
        router.push(`/dashboard?joined=${r.data.slug}`);
      } else if (!r.ok && r.error === "Please log in first.") {
        try {
          sessionStorage.setItem(DRAFT_KEY, JSON.stringify(draft));
        } catch {}
        router.push(`/login?next=${encodeURIComponent("/join?resume=1")}`);
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
          placeholder="e.g. SaaS, e-commerce, fintech"
          value={draft.category}
          maxLength={60}
          onChange={(e) => setDraft({ ...draft, category: e.target.value })}
        />
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
        <button className="btn flex-1 bg-red text-white" onClick={save} disabled={pending || !draft.name.trim()}>
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
