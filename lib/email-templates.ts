/*
  Every email Backlink Arena sends, in one place.
  - App emails (welcome, leads) are sent from the server via lib/email.ts (Resend API).
  - Auth emails (confirm signup, magic link) are sent BY SUPABASE: run `npm run emails:build`
    to regenerate supabase/templates/*.html, then paste them into Supabase → Auth → Email Templates.
*/
import { button, eyebrow, esc, h1, layout, linkFallback, p, panel, rows, steps, vs } from "./email-layout";

export type Rendered = { subject: string; html: string; text: string };

/** Supabase link: token_hash flow, verified on our server, works in any browser or device. */
const SUPABASE_LINK = "{{ .RedirectTo }}&token_hash={{ .TokenHash }}&type=email";

// ---------------------------------------------------------------------------
// Supabase auth emails (placeholders are filled by Supabase, not by us)
// ---------------------------------------------------------------------------

export function confirmSignupEmail(): Rendered {
  const subject = "Welcome to Backlink Arena: confirm your email";
  const html = layout({
    title: subject,
    preheader: "One click and you're in the arena.",
    body:
      eyebrow("Welcome") +
      h1("Step into", "the arena") +
      p("One click to confirm your email and save your website. Then the fun starts: share your page, collect votes, and get seen by people who've never heard of you.") +
      button(SUPABASE_LINK, "Confirm & enter", { raw: true }) +
      steps() +
      linkFallback(SUPABASE_LINK, { raw: true }),
    footer: "Didn't sign up? Just ignore this email and nothing happens.",
  });
  const text = `Welcome to Backlink Arena\n\nConfirm your email and save your website:\n${SUPABASE_LINK}\n\nDidn't sign up? Just ignore this email.`;
  return { subject, html, text };
}

export function magicLinkEmail(): Rendered {
  const subject = "Your Backlink Arena login link";
  const html = layout({
    title: subject,
    preheader: "Your one-click login. Works once, expires in an hour.",
    body:
      eyebrow("Log in") +
      h1("Back into", "the arena") +
      p("Here's your login link. It works once and expires in one hour, and you can open it on any device.") +
      button(SUPABASE_LINK, "Log in", { raw: true }) +
      linkFallback(SUPABASE_LINK, { raw: true }),
    footer: "Didn't ask for this? Ignore it. Nobody can log in without this link.",
  });
  const text = `Your Backlink Arena login link (works once, expires in an hour):\n${SUPABASE_LINK}`;
  return { subject, html, text };
}

// ---------------------------------------------------------------------------
// App emails
// ---------------------------------------------------------------------------

/** After a website joins. */
export function welcomeEmail(o: { name: string; slug: string; entered: boolean; siteUrl: string }): Rendered {
  const page = `${o.siteUrl}/p/${o.slug}`;
  const pageLabel = page.replace(/^https?:\/\//, "");
  const status = o.entered
    ? "You're in the current tournament. Every vote on your page counts toward a bracket spot."
    : "You'll be entered automatically when the next tournament opens. Your page is already live.";
  const subject = `${o.name} is in the arena`;
  const html = layout({
    title: subject,
    preheader: `${o.name} is in. Share your page to start collecting votes.`,
    body:
      eyebrow(o.entered ? "You're in" : "Spot saved") +
      h1(o.name, "is in the arena") +
      p(esc(status)) +
      vs(o.name, "Your rival") +
      p("Your rival shares this matchup with their followers, and you share it with yours. Both sites are on every share, so new people find you either way.", { muted: true, small: true }) +
      button(`${o.siteUrl}/dashboard`, "Open your dashboard") +
      panel(
        `<strong style="color:#fbbf24">Your page</strong><br><a href="${esc(page)}" style="color:#fafaf9">${esc(pageLabel)}</a>` +
          `<br><br><strong style="color:#fbbf24">Get more votes</strong><br>` +
          `Post twice: at the start and in the last hours. Ask 5 people directly. Say "one click, no sign-up".`,
      ),
  });
  const text = `${o.name} is in the arena\n\n${status}\n\nYour page: ${page}\nYour dashboard: ${o.siteUrl}/dashboard\n\nTip: post twice (start + last hours), ask 5 people directly, and say "one click, no sign-up".`;
  return { subject, html, text };
}

export type LeadInfo = {
  name: string;
  email: string;
  what: string;
  website: string;
  message: string;
  /** Fraction, as stored in leads.discount (0.3 = 30% off). */
  discount: number;
};

const pct = (d: number) => `${Math.round(d * 100)}%`;

/** To the admin when someone asks about a service. Reply goes straight to the lead. */
export function leadAdminEmail(l: LeadInfo, siteUrl: string): Rendered {
  const items: [string, string][] = [
    ["Service", l.what],
    ["Name", l.name || "-"],
    ["Email", l.email],
    ["Website", l.website || "-"],
    ["Discount", l.discount ? `${pct(l.discount)} participant offer` : "-"],
    ["Message", l.message || "-"],
  ];
  const subject = `New lead: ${l.what}`;
  const html = layout({
    title: subject,
    preheader: `${l.name || l.email} asked about ${l.what}.`,
    body:
      eyebrow("New lead") +
      h1(l.name || l.email) +
      p(`asked about <strong style="color:#fbbf24">${esc(l.what)}</strong>. Hit reply to answer them directly.`) +
      rows(items) +
      button(`${siteUrl}/admin/leads`, "Open leads"),
    footer: "Admin notification from Backlink Arena.",
  });
  const text = `New lead: ${l.what}\n\n${items.map(([k, v]) => `${k}: ${v}`).join("\n")}\n\nReply to this email to answer them.`;
  return { subject, html, text };
}

/** To the person who asked, so they know it arrived. */
export function leadConfirmEmail(l: LeadInfo): Rendered {
  const subject = "We got your request";
  const html = layout({
    title: subject,
    preheader: "We'll get back to you within one business day.",
    body:
      eyebrow("Request received") +
      h1(`Thanks${l.name ? `, ${l.name}` : ""}!`) +
      p(`We got your request for <strong style="color:#fbbf24">${esc(l.what)}</strong> and will get back to you within one business day.`) +
      (l.discount
        ? panel(`<strong style="color:#fbbf24">${pct(l.discount)} participant discount</strong><br>Saved with your request. We'll apply it to your quote.`)
        : "") +
      p("Want to add something? Just reply to this email.", { muted: true }),
    footer: "You're getting this because you sent a request on Backlink Arena.",
  });
  const text = `Thanks${l.name ? `, ${l.name}` : ""}!\n\nWe got your request for ${l.what} and will get back to you within one business day.${
    l.discount ? `\nYour ${pct(l.discount)} participant discount is saved with the request.` : ""
  }\n\nJust reply to this email if you want to add anything.`;
  return { subject, html, text };
}
