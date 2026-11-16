/*
  Email design system, in the site's dark + gold "arena" look.
  Pure string builders (no server-only imports) so both the app (lib/email.ts) and
  scripts/build-email-templates.mts (Supabase templates) use the exact same design.

  Email-safe rules: tables for layout, inline styles only, a solid `bgcolor` fallback under
  every gradient (Outlook/Gmail drop some gradients), no SVG, web font with Arial fallbacks.
*/

const INK = "#0c0a09";
const PANEL = "#1c1917";
const TEXT = "#e7e5e4";
const MUTED = "#a8a29e";
const FAINT = "#78716c";
const GOLD = "#fbbf24";
const ORANGE = "#f97316";
const TEAL = "#14b8a6";
const DISPLAY = "'Archivo Black','Archivo','Arial Black',Arial,Helvetica,sans-serif";
const BODY = "Arial,Helvetica,sans-serif";

/** Escapes text for HTML. Use on every value that didn't come from us. */
export function esc(s: string | null | undefined): string {
  return String(s ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

/** Small gold all-caps label above a headline. */
export function eyebrow(text: string): string {
  return `<p style="margin:0 0 10px;font:700 11px/1 ${BODY};letter-spacing:3px;text-transform:uppercase;color:${GOLD}">${esc(text)}</p>`;
}

/** Big italic headline. `gold` is an optional trailing part in gold. */
export function h1(text: string, gold?: string): string {
  return `<h1 style="margin:0 0 14px;font:900 italic 30px/1.15 ${DISPLAY};letter-spacing:-.5px;color:#fafaf9">${esc(text)}${
    gold ? ` <span style="color:${GOLD}">${esc(gold)}</span>` : ""
  }</h1>`;
}

/** Body paragraph. Pass already-safe HTML (use esc() for user values). */
export function p(html: string, opts: { muted?: boolean; small?: boolean } = {}): string {
  const size = opts.small ? "13px/1.55" : "15px/1.65";
  return `<p style="margin:0 0 14px;font:400 ${size} ${BODY};color:${opts.muted ? MUTED : TEXT}">${html}</p>`;
}

/** Gold pill button, table-based so it renders in Outlook too. `href` may be a template placeholder. */
export function button(href: string, label: string, opts: { raw?: boolean } = {}): string {
  const url = opts.raw ? href : esc(href);
  return `<table role="presentation" cellpadding="0" cellspacing="0" border="0" style="margin:26px 0 6px"><tr>
<td bgcolor="#f59e0b" style="border-radius:999px;background:#f59e0b;background-image:linear-gradient(180deg,#fde68a 0%,#fbbf24 45%,#d97706 100%);box-shadow:0 10px 24px -10px rgba(251,191,36,.8)">
<a href="${url}" target="_blank" style="display:inline-block;padding:15px 34px;font:900 italic 16px/1 ${DISPLAY};letter-spacing:.5px;text-transform:uppercase;color:#1c1917;text-decoration:none;border-radius:999px">${esc(label)} &rarr;</a>
</td></tr></table>`;
}

/** Fallback line under a button with the raw link, for clients that block buttons. */
export function linkFallback(href: string, opts: { raw?: boolean } = {}): string {
  const url = opts.raw ? href : esc(href);
  return `<p style="margin:10px 0 0;font:400 12px/1.5 ${BODY};color:${FAINT}">Button not working? Paste this into your browser:<br><a href="${url}" style="color:${MUTED};word-break:break-all">${url}</a></p>`;
}

/** Inner panel with a gold hairline: for key facts or tips. */
export function panel(html: string): string {
  return `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="margin:22px 0 4px"><tr>
<td bgcolor="#141110" style="border:1px solid #57391b;border-radius:14px;background:#141110;padding:18px 20px;font:400 14px/1.6 ${BODY};color:${TEXT}">${html}</td>
</tr></table>`;
}

/** Two fighters with a gold VS between them, like the matchup cards on the site. */
export function vs(a: string, b: string): string {
  const side = (name: string, color: string) =>
    `<td width="42%" align="center" bgcolor="#141110" style="border:2px solid ${color};border-radius:16px;background:#141110;padding:18px 8px">
<div style="font:900 italic 18px/1.2 ${DISPLAY};color:#fafaf9;text-transform:uppercase;word-break:break-word">${esc(name)}</div></td>`;
  return `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="margin:22px 0 6px"><tr>
${side(a, ORANGE)}
<td width="16%" align="center" style="font:900 italic 30px/1 ${DISPLAY};color:${GOLD};letter-spacing:-1px">VS</td>
${side(b, TEAL)}
</tr></table>`;
}

/** The three steps (Enter · Battle · Win) as small columns. */
export function steps(): string {
  const items: [string, string, string][] = [
    ["01", "Enter", "Free, or skip qualifying with the badge."],
    ["02", "Battle", "1v1 votes. Every share shows you to new people."],
    ["03", "Win", "A backlink on a real DA 50+ site."],
  ];
  return `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="margin:24px 0 0;border-top:1px solid #2e2724"><tr>
${items
  .map(
    ([n, t, d]) => `<td width="33%" valign="top" style="padding:16px 8px 0 0">
<div style="font:900 italic 20px/1 ${DISPLAY};color:${GOLD}">${n}</div>
<div style="margin:6px 0 4px;font:700 13px/1.2 ${BODY};letter-spacing:1px;text-transform:uppercase;color:#fafaf9">${t}</div>
<div style="font:400 12px/1.45 ${BODY};color:${MUTED}">${d}</div></td>`,
  )
  .join("")}
</tr></table>`;
}

/** Key/value rows, e.g. for the admin lead email. Values are escaped. */
export function rows(items: [string, string][]): string {
  return `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="margin:8px 0 0">${items
    .map(
      ([k, v]) => `<tr>
<td valign="top" style="padding:9px 14px 9px 0;border-bottom:1px solid #2e2724;font:700 11px/1.6 ${BODY};letter-spacing:1.5px;text-transform:uppercase;color:${FAINT};white-space:nowrap">${esc(k)}</td>
<td style="padding:9px 0;border-bottom:1px solid #2e2724;font:400 14px/1.6 ${BODY};color:#fafaf9;white-space:pre-line">${esc(v)}</td></tr>`,
    )
    .join("")}</table>`;
}

/**
 * Full email. `preheader` is the grey preview line in the inbox list.
 * `body` is inner HTML built from the helpers above.
 */
export function layout(o: { title: string; preheader: string; body: string; footer?: string }): string {
  return `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<meta name="color-scheme" content="dark">
<meta name="supported-color-schemes" content="dark">
<title>${esc(o.title)}</title>
<link href="https://fonts.googleapis.com/css2?family=Archivo:ital,wght@1,900&display=swap" rel="stylesheet">
</head>
<body style="margin:0;padding:0;background:${INK}" bgcolor="${INK}">
<div style="display:none;max-height:0;overflow:hidden;opacity:0;color:${INK}">${esc(o.preheader)}&#8199;&#65279;&#847;&#8199;&#65279;&#847;&#8199;&#65279;&#847;&#8199;&#65279;&#847;</div>
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" bgcolor="${INK}" style="background:${INK};background-image:radial-gradient(60% 40% at 50% 0%,rgba(249,115,22,.22),transparent 70%)">
<tr><td align="center" style="padding:36px 14px 28px">

<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="max-width:560px">
  <tr><td style="padding:0 6px 18px">
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0"><tr>
      <td style="font:900 italic 20px/1 ${DISPLAY};letter-spacing:.5px;color:#fafaf9">BACKLINK <span style="color:${GOLD}">ARENA</span></td>
      <td align="right"><span style="display:inline-block;padding:6px 12px;border:1px solid #57391b;border-radius:999px;font:700 10px/1 ${BODY};letter-spacing:2px;color:#fcd34d">1V1 &middot; DA 50+</span></td>
    </tr></table>
  </td></tr>

  <tr><td bgcolor="#f97316" height="4" style="height:4px;line-height:4px;font-size:0;border-radius:4px 4px 0 0;background:#f97316;background-image:linear-gradient(90deg,#fbbf24,#f97316 35%,#e11d48 65%,#14b8a6)">&nbsp;</td></tr>

  <tr><td bgcolor="${PANEL}" style="background:${PANEL};background-image:radial-gradient(70% 50% at 100% 0%,rgba(249,115,22,.16),transparent 60%),radial-gradient(60% 50% at 0% 100%,rgba(13,148,136,.14),transparent 60%),linear-gradient(165deg,#241e1b,#141110);border:1px solid #3a2a1c;border-top:0;border-radius:0 0 22px 22px;padding:34px 34px 32px">
${o.body}
  </td></tr>

  <tr><td align="center" style="padding:22px 20px 0;font:400 12px/1.6 ${BODY};color:${FAINT}">
    ${o.footer ?? "You're getting this because you use Backlink Arena."}<br>
    <span style="color:#57534e">Backlink Arena &middot; Strong backlinks shouldn't only be for big budgets.</span>
  </td></tr>
</table>

</td></tr></table>
</body>
</html>`;
}
