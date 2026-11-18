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
        <div className="p-5 sm:p-6">
          <div className="flex items-start justify-between gap-3">
            <div>
              <p className="font-display text-2xl font-extrabold">
                {sent ? "Thanks, we'll be in touch!" : contact ? "Contact us" : "Talk to us"}
              </p>
              <p className="mt-1 text-sm text-muted">
                {sent
                  ? "We usually reply within one business day."
                  : contact
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

          {sent ? (
            <button type="button" onClick={() => dialog.current?.close()} className="btn mt-5 w-full bg-ink text-white">
              Close
            </button>
          ) : (
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
          )}
        </div>
      </dialog>
    </>
  );
}
