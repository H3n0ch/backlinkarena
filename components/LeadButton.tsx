"use client";

import { useRef, useState, useTransition } from "react";
import { submitLead } from "@/app/actions/lead";
import { CONTACT_TOPICS, SERVICE_OPTIONS } from "@/lib/services";

/**
 * "Talk to us" button that opens a short enquiry form and saves it as a lead.
 * `offer` = participant offer (30% off), tied to one of the visitor's own sites.
 * `contact` = the footer "Contact" form: same modal, general topics, message required.
 */
export function LeadButton({
  label,
  className,
  service,
  defaultEmail = "",
  defaultWebsite = "",
  offer,
  contact = false,
}: {
  label: string;
  className?: string;
  /** Preselected "Service · Tier" (see SERVICE_OPTIONS). */
  service?: string;
  defaultEmail?: string;
  defaultWebsite?: string;
  offer?: { productId: string; discountLabel: string };
  contact?: boolean;
}) {
  const options = contact ? CONTACT_TOPICS : SERVICE_OPTIONS;
  const dialog = useRef<HTMLDialogElement>(null);
  const [form, setForm] = useState({
    service: service ?? options[0],
    name: "",
    email: defaultEmail,
    website: defaultWebsite,
    message: "",
    company: "",
  });
  const [error, setError] = useState<string | null>(null);
  const [sent, setSent] = useState(false);
  const [pending, start] = useTransition();
  const set = (k: keyof typeof form) => (e: { target: { value: string } }) => setForm({ ...form, [k]: e.target.value });

  function open() {
    setSent(false);
    setError(null);
    if (service) setForm((f) => ({ ...f, service }));
    dialog.current?.showModal();
  }

  function submit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    start(async () => {
      const r = await submitLead({
        ...form,
        source: contact ? "contact" : offer ? "participant_offer" : "services",
        productId: offer?.productId,
      });
      if (r.ok) setSent(true);
      else setError(r.error);
    });
  }

  const field = "field w-full";
  return (
    <>
      <button type="button" onClick={open} className={className}>
        {label}
      </button>
      <dialog
        ref={dialog}
        onClick={(e) => e.target === dialog.current && dialog.current?.close()}
        className="m-auto w-[min(32rem,calc(100%-2rem))] rounded-2xl p-0 text-ink shadow-2xl backdrop:bg-black/50 backdrop:backdrop-blur-sm"
      >
        {sent ? (
          <SentView
            form={form}
            contact={contact}
            offer={offer}
            onClose={() => dialog.current?.close()}
          />
        ) : (
        <div className="p-5 sm:p-6">
          <div className="flex items-start justify-between gap-3">
            <div>
              <p className="font-display text-2xl font-extrabold">{contact ? "Contact us" : "Talk to us"}</p>
              <p className="mt-1 text-sm text-muted">
                {contact
                  ? "A question about the arena, your entry or a payment? Write us, we reply within one business day."
                  : offer
                    ? `Your participant price (${offer.discountLabel}) is saved with this request.`
                    : "Tell us about your site. We'll reply with a plan and the exact price."}
              </p>
            </div>
            <button
              type="button"
              aria-label="Close"
              onClick={() => dialog.current?.close()}
              className="rounded-lg px-2 text-2xl leading-none text-muted hover:bg-cream"
            >
              ×
            </button>
          </div>

            <form onSubmit={submit} className="mt-5 flex flex-col gap-3 text-left">
              <label className="flex flex-col gap-1 text-sm font-semibold">
                {contact ? "What's it about?" : "What are you interested in?"}
                <select className={field} value={form.service} onChange={set("service")}>
                  {options.map((o) => (
                    <option key={o}>{o}</option>
                  ))}
                </select>
              </label>
              <div className="grid gap-3 sm:grid-cols-2">
                <label className="flex flex-col gap-1 text-sm font-semibold">
                  Email *
                  <input className={field} type="email" required value={form.email} onChange={set("email")} />
                </label>
                <label className="flex flex-col gap-1 text-sm font-semibold">
                  Name
                  <input className={field} value={form.name} onChange={set("name")} maxLength={120} />
                </label>
              </div>
              <label className="flex flex-col gap-1 text-sm font-semibold">
                Website
                <input
                  className={field}
                  placeholder="yourproduct.com"
                  value={form.website}
                  onChange={set("website")}
                  maxLength={300}
                />
              </label>
              <label className="flex flex-col gap-1 text-sm font-semibold">
                {contact ? "Message *" : "Anything we should know?"}
                <textarea
                  className={`${field} ${contact ? "min-h-28" : "min-h-20"}`}
                  placeholder={contact ? "How can we help?" : "Your niche, goals, target pages…"}
                  required={contact}
                  value={form.message}
                  onChange={set("message")}
                  maxLength={2000}
                />
              </label>
              {/* Honeypot, hidden from people */}
              <input
                tabIndex={-1}
                autoComplete="off"
                aria-hidden="true"
                className="hidden"
                value={form.company}
                onChange={set("company")}
              />
              <button className="btn bg-red text-white" disabled={pending}>
                {pending ? "Sending…" : contact ? "Send message" : "Send request"}
              </button>
              {error && <p className="text-sm font-semibold text-red">{error}</p>}
            </form>
        </div>
        )}
      </dialog>
    </>
  );
}

/** Success state: confirmation, a summary of what was sent, and what happens next. */
function SentView({
  form,
  contact,
  offer,
  onClose,
}: {
  form: { service: string; name: string; email: string; website: string; message: string };
  contact: boolean;
  offer?: { productId: string; discountLabel: string };
  onClose: () => void;
}) {
  const firstName = form.name.trim().split(/\s+/)[0];
  const steps = contact
    ? [
        ["We read your message", "A real person on the team looks at it, no bots."],
        ["We reply within one business day", `The answer goes to ${form.email}.`],
        ["Sorted", "Most questions are resolved in a single reply."],
      ]
    : [
        ["We review your site", form.website ? `We look at ${form.website}, its niche and current links.` : "We look at your niche, goals and current links."],
        ["You get a plan and exact price", `Within one business day, sent to ${form.email}.`],
        ["Coffee time", "Your plan is on its way. We'll be in your inbox soon."],
      ];
  const summary: [string, string][] = [
    [contact ? "Topic" : "Interested in", form.service],
    ["Reply to", form.email],
    ...(form.website ? [["Website", form.website] as [string, string]] : []),
    ...(offer ? [["Your price", `Participant offer · ${offer.discountLabel}`] as [string, string]] : []),
  ];

  return (
    <div className="relative overflow-hidden">
      {/* Header band */}
      <div
        className="relative px-5 pb-6 pt-7 text-center text-white sm:px-6"
        style={{ background: "var(--grad-dark)" }}
      >
        <button
          type="button"
          aria-label="Close"
          onClick={onClose}
          className="absolute right-3 top-3 rounded-lg px-2 text-2xl leading-none text-white/70 hover:bg-white/10 hover:text-white"
        >
          ×
        </button>
        <div
          className="mx-auto grid size-14 place-items-center rounded-full text-white shadow-lg ring-4 ring-white/10"
          style={{ background: "var(--grad-brand)" }}
        >
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={3} className="size-7" aria-hidden="true">
            <path d="M5 12.5l4.5 4.5L19 7.5" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        </div>
        <p className="mt-4 font-display text-2xl font-extrabold sm:text-3xl">
          {contact ? "Message received" : "Request received"}
          {firstName ? `, ${firstName}` : ""}!
        </p>
        <p className="mx-auto mt-1.5 max-w-sm text-sm text-white/75">
          Thanks for reaching out. We&apos;ve sent a confirmation to{" "}
          <span className="font-semibold text-white">{form.email}</span>.
        </p>
      </div>

      <div className="flex flex-col gap-5 p-5 sm:p-6">
        {/* What you sent */}
        <div className="rounded-xl border border-line bg-cream/60 p-4">
          <p className="text-xs font-bold uppercase tracking-wider text-muted">Your request</p>
          <dl className="mt-2 grid grid-cols-[auto_1fr] gap-x-4 gap-y-1.5 text-sm">
            {summary.map(([k, v]) => (
              <div key={k} className="contents">
                <dt className="text-muted">{k}</dt>
                <dd className="truncate text-right font-semibold">{v}</dd>
              </div>
            ))}
          </dl>
        </div>

        {/* What happens next */}
        <div>
          <p className="text-xs font-bold uppercase tracking-wider text-muted">What happens next</p>
          <ol className="mt-3 flex flex-col gap-3">
            {steps.map(([title, body], i) => (
              <li key={title} className="flex gap-3">
                <span className="grid size-7 shrink-0 place-items-center rounded-full bg-red-soft text-sm font-extrabold text-red-dark">
                  {i + 1}
                </span>
                <div className="text-sm">
                  <p className="font-semibold">{title}</p>
                  <p className="text-muted">{body}</p>
                </div>
              </li>
            ))}
          </ol>
        </div>

        <p className="rounded-lg bg-blue-soft px-3 py-2 text-xs text-ink/80">
          Can&apos;t find our email? Check your spam or promotions folder and mark us as safe, so our reply lands in
          your inbox.
        </p>

        <button type="button" onClick={onClose} className="btn w-full bg-red text-white">
          Back to the arena
        </button>
      </div>
    </div>
  );
}
