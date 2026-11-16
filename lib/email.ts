import "server-only";
import type { Rendered } from "./email-templates";

/*
  Transactional email through Resend (https://resend.com), via its REST API, so no SDK is needed.
  - RESEND_API_KEY  required to send; without it every send is skipped (logged once), never an error.
  - EMAIL_FROM      e.g. "Backlink Arena <hello@backlinkarena.com>" (must be on a domain verified in Resend).
  Templates live in lib/email-templates.ts. Login / signup emails are sent by Supabase
  (generated into supabase/templates/ with `npm run emails:build`).
*/

const API = "https://api.resend.com/emails";
const FROM = process.env.EMAIL_FROM || "Backlink Arena <onboarding@resend.dev>";
let warned = false;

/** Sends one rendered email. Returns false (and logs) on any problem; never throws. */
export async function sendEmail(to: string | string[], email: Rendered, opts: { replyTo?: string } = {}): Promise<boolean> {
  const key = process.env.RESEND_API_KEY;
  if (!key) {
    if (!warned) console.warn("email: RESEND_API_KEY is not set, skipping emails");
    warned = true;
    return false;
  }
  try {
    const res = await fetch(API, {
      method: "POST",
      headers: { authorization: `Bearer ${key}`, "content-type": "application/json" },
      body: JSON.stringify({
        from: FROM,
        to,
        subject: email.subject,
        html: email.html,
        text: email.text,
        ...(opts.replyTo ? { reply_to: opts.replyTo } : {}),
      }),
      signal: AbortSignal.timeout(10_000),
    });
    if (!res.ok) {
      console.error("email: Resend refused", res.status, await res.text());
      return false;
    }
    return true;
  } catch (err) {
    console.error("email: send failed", err);
    return false;
  }
}
