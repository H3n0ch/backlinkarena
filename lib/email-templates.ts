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
    : "We'll email you when the next tournament opens, so you can enter. Your page is already live.";
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
  /** From the footer contact form (a message, not a service request). */
  contact?: boolean;
};

const pct = (d: number) => `${Math.round(d * 100)}%`;

/** To the admin when someone asks about a service. Reply goes straight to the lead. */
export function leadAdminEmail(l: LeadInfo, siteUrl: string): Rendered {
  const items: [string, string][] = [
    [l.contact ? "Topic" : "Service", l.what],
    ["Name", l.name || "-"],
    ["Email", l.email],
    ["Website", l.website || "-"],
    ...(l.contact ? [] : [["Discount", l.discount ? `${pct(l.discount)} participant offer` : "-"] as [string, string]]),
    ["Message", l.message || "-"],
  ];
  const subject = l.contact ? `New message: ${l.what}` : `New lead: ${l.what}`;
  const html = layout({
    title: subject,
    preheader: `${l.name || l.email} ${l.contact ? "wrote about" : "asked about"} ${l.what}.`,
    body:
      eyebrow(l.contact ? "New message" : "New lead") +
      h1(l.name || l.email) +
      p(`asked about <strong style="color:#fbbf24">${esc(l.what)}</strong>. Hit reply to answer them directly.`) +
      rows(items) +
      button(`${siteUrl}/admin/leads`, "Open leads"),
    footer: "Admin notification from Backlink Arena.",
  });
  const text = `${subject}\n\n${items.map(([k, v]) => `${k}: ${v}`).join("\n")}\n\nReply to this email to answer them.`;
  return { subject, html, text };
}

/** To the person who asked, so they know it arrived. */
export function leadConfirmEmail(l: LeadInfo): Rendered {
  const subject = l.contact ? "We got your message" : "We got your request";
  const what = l.contact ? "message about" : "request for";
  const html = layout({
    title: subject,
    preheader: "We'll get back to you within one business day.",
    body:
      eyebrow(l.contact ? "Message received" : "Request received") +
      h1(`Thanks${l.name ? `, ${l.name}` : ""}!`) +
      p(`We got your ${what} <strong style="color:#fbbf24">${esc(l.what)}</strong> and will get back to you within one business day.`) +
      (l.discount
        ? panel(`<strong style="color:#fbbf24">${pct(l.discount)} participant discount</strong><br>Saved with your request. We'll apply it to your quote.`)
        : "") +
      p("Want to add something? Just reply to this email.", { muted: true }),
    footer: `You're getting this because you sent a ${l.contact ? "message" : "request"} on Backlink Arena.`,
  });
  const text = `Thanks${l.name ? `, ${l.name}` : ""}!\n\nWe got your ${what} ${l.what} and will get back to you within one business day.${
    l.discount ? `\nYour ${pct(l.discount)} participant discount is saved with the request.` : ""
  }\n\nJust reply to this email if you want to add anything.`;
  return { subject, html, text };
}

// ---------------------------------------------------------------------------
// Badge checks
// ---------------------------------------------------------------------------

/** To the admin when the automatic badge check failed and someone waits for a manual check. */
export function badgeCheckAdminEmail(o: {
  name: string;
  domain: string;
  page: string;
  posts: string[];
  owner: string;
  siteUrl: string;
}): Rendered {
  const items: [string, string][] = [
    ["Site", `${o.name} (${o.domain})`],
    ["Owner", o.owner || "-"],
    ["Badge page", o.page],
    ...o.posts.map((x, i): [string, string] => [`Social post ${i + 1}`, x]),
  ];
  const subject = `Badge to check: ${o.domain}`;
  const html = layout({
    title: subject,
    preheader: `${o.domain} says the badge is on their site. The automatic check didn't find it.`,
    body:
      eyebrow("Badge check") +
      h1(o.name) +
      p("says our badge is on their site, but the automatic check didn't find it (often a site that loads with JavaScript). Open the page, look for the link to Backlink Arena, check their two social posts, then approve or reject it in the control room.") +
      rows(items) +
      button(o.page, "Open their page") +
      button(`${o.siteUrl}/admin#badge-checks`, "Open badge checks"),
    footer: "Admin notification from Backlink Arena.",
  });
  const text = `Badge to check: ${o.name} (${o.domain})\nOwner: ${o.owner || "-"}\nPage: ${o.page}\n${o.posts.map((x, i) => `Post ${i + 1}: ${x}`).join("\n")}\n\nApprove or reject: ${o.siteUrl}/admin#badge-checks`;
  return { subject, html, text };
}

/** To the owner once their badge is verified. */
export function badgeVerifiedEmail(o: { name: string; tournament: string | null; siteUrl: string }): Rendered {
  const subject = `Badge verified: ${o.name} skips qualifying`;
  const status = o.tournament
    ? `${o.name} is in ${o.tournament} with a guaranteed-spot priority: badge brands get bracket seats right after paid ones, before anyone voted in.`
    : `When the next tournament opens, enter ${o.name} from your dashboard. Badge brands get bracket seats right after paid ones, before anyone voted in.`;
  const html = layout({
    title: subject,
    preheader: "Thanks for linking to Backlink Arena. You skip qualifying.",
    body:
      eyebrow("Badge verified") +
      h1(o.name, "skips qualifying") +
      p(`Thanks for linking to Backlink Arena. ${esc(status)}`) +
      p("Keep the badge on your site while the tournament runs.", { muted: true }) +
      button(`${o.siteUrl}/dashboard`, "Open your dashboard"),
    footer: "You're getting this because you asked us to check your badge on Backlink Arena.",
  });
  const text = `Badge verified: ${o.name} skips qualifying.\n\n${status}\n\nKeep the badge on your site while the tournament runs.\n\nDashboard: ${o.siteUrl}/dashboard`;
  return { subject, html, text };
}

/** To the owner when the admin couldn't find the badge. */
export function badgeRejectedEmail(o: { name: string; page: string; siteUrl: string }): Rendered {
  const subject = `We couldn't find the badge on ${o.name}`;
  const html = layout({
    title: subject,
    preheader: "Check the link and try again from your dashboard.",
    body:
      eyebrow("Badge not found") +
      h1(o.name) +
      p(`We looked at <strong style="color:#fbbf24">${esc(o.page)}</strong> but didn't find a followed link to Backlink Arena. Make sure the badge code is on that page, is visible, and has no rel="nofollow", then check again from your dashboard.`) +
      p("Questions? Just reply to this email.", { muted: true }) +
      button(`${o.siteUrl}/dashboard`, "Check again"),
    footer: "You're getting this because you asked us to check your badge on Backlink Arena.",
  });
  const text = `We couldn't find the badge on ${o.page}.\n\nMake sure the badge code is on that page, is visible, and has no rel="nofollow", then check again: ${o.siteUrl}/dashboard\n\nQuestions? Just reply to this email.`;
  return { subject, html, text };
}

// ---------------------------------------------------------------------------
// Tournament emails (sent automatically by lib/tournament-emails.ts)
// ---------------------------------------------------------------------------

export type ExposureStats = { views: number; clicks: number; votes: number };

/** Closing line of the knockout / results emails: entering the next tournament is up to them. */
const NEXT_LINE = "When the next tournament opens, you can enter again from your dashboard.";

const fmtDate = (d: Date) =>
  d.toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric", timeZone: "UTC" });

/** To a brand the moment its run ends: knocked out, lost the final, or didn't make the bracket. */
export function knockoutEmail(o: {
  name: string;
  tournament: string;
  /** "Didn't make the bracket", "Quarterfinals", "Final", ... */
  reached: string;
  /** 0 = didn't make the bracket; otherwise the round they lost in. */
  round: number;
  final: boolean;
  stats: ExposureStats;
  expires: Date;
  discount: number;
  siteUrl: string;
}): Rendered {
  const off = pct(o.discount);
  const until = fmtDate(o.expires);
  const headline: [string, string] =
    o.round === 0 ? [o.name, "didn't make the bracket"] : o.final ? [o.name, "reached the final"] : [o.name, `is out`];
  const intro =
    o.round === 0
      ? `${o.name} didn't collect enough qualifying votes for a bracket spot in ${o.tournament} this time.`
      : o.final
        ? `${o.name} made it all the way to the final of ${o.tournament} and lost by a few votes. That's a serious run.`
        : `${o.name} was knocked out in the ${o.reached.toLowerCase()} of ${o.tournament}.`;
  const subject = o.final ? `${o.name} reached the final: your ${off} offer` : `${o.name} is out: your ${off} offer inside`;
  const statRows: [string, string][] = [
    ["Page views", String(o.stats.views)],
    ["Clicks to your site", String(o.stats.clicks)],
    ["Votes", String(o.stats.votes)],
  ];
  const html = layout({
    title: subject,
    preheader: `${off} off our backlink services until ${until}.`,
    body:
      eyebrow(o.round === 0 ? "Qualifying over" : o.final ? "Runner-up" : "Knocked out") +
      h1(headline[0], headline[1]) +
      p(esc(intro)) +
      p("Here's what your matchups brought in:", { muted: true, small: true }) +
      rows(statRows) +
      panel(
        `<strong style="color:#fbbf24">${off} off our services until ${esc(until)}</strong><br>` +
          `You played and shared your matchups, so you get backlink placement at ${off} off for 7 days. Request it from your dashboard and the discount is applied to your quote.`,
      ) +
      button(`${o.siteUrl}/dashboard`, "Claim your offer") +
      p(NEXT_LINE, { muted: true, small: true }),
    footer: "You're getting this because your website played in a Backlink Arena tournament.",
  });
  const text = `${intro}\n\nYour exposure: ${o.stats.views} page views, ${o.stats.clicks} clicks to your site, ${o.stats.votes} votes.\n\n${off} off our services until ${until}. Claim it in your dashboard: ${o.siteUrl}/dashboard\n\n${NEXT_LINE}`;
  return { subject, html, text };
}

/** Rally tips shared by the during-tournament emails. */
const RALLY_TIPS =
  `<strong style="color:#fbbf24">What gets votes</strong><br>` +
  `Post the matchup where your audience already is. Message 5 people directly. Say "one click, no sign-up". Post again in the last hours.`;

/** When a brand's match opens: round 1 means they made the bracket, later rounds mean they won the last one. */
export function matchLiveEmail(o: {
  name: string;
  opponent: string;
  tournament: string;
  /** "Round of 16", "Quarterfinals", "Final"... */
  roundName: string;
  firstRound: boolean;
  final: boolean;
  timeLeft: string;
  shareUrl: string;
  siteUrl: string;
}): Rendered {
  const subject = o.final
    ? `${o.name} is in the final. Voting is open`
    : o.firstRound
      ? `${o.name} made the bracket. Your match is live`
      : `${o.name} won! ${o.roundName} vs ${o.opponent} is live`;
  const intro = o.firstRound
    ? `${o.name} made the bracket of ${o.tournament}. Your first matchup is open, and the side with more votes in ${o.timeLeft} goes through.`
    : `${o.name} won its last matchup and is through to the ${o.roundName.toLowerCase()} of ${o.tournament}. Voting is open for ${o.timeLeft}.`;
  const html = layout({
    title: subject,
    preheader: `${o.roundName}: ${o.name} vs ${o.opponent}. Share your matchup to get votes.`,
    body:
      eyebrow(o.final ? "The final" : o.firstRound ? "You're in the bracket" : `${o.roundName}`) +
      h1(o.final ? "One match from" : "Your match", o.final ? "the backlink" : "is live") +
      p(esc(intro)) +
      vs(o.name, o.opponent) +
      p("Your opponent is sharing this too. Every share shows both sites, so the first hours count.", { muted: true, small: true }) +
      button(o.shareUrl, "Open & share your matchup") +
      panel(RALLY_TIPS + `<br><br>Ready-made posts and a matchup image are in your <a href="${esc(`${o.siteUrl}/dashboard`)}" style="color:#fbbf24">rally kit</a>.`) +
      linkFallback(o.shareUrl),
    footer: "You're getting this because your website is playing in a Backlink Arena tournament.",
  });
  const text = `${intro}\n\n${o.name} vs ${o.opponent}\n\nShare your matchup: ${o.shareUrl}\nRally kit: ${o.siteUrl}/dashboard`;
  return { subject, html, text };
}

/** Near the end of a match the brand is losing. */
export function behindEmail(o: {
  name: string;
  opponent: string;
  roundName: string;
  mine: number;
  theirs: number;
  timeLeft: string;
  shareUrl: string;
  siteUrl: string;
}): Rendered {
  const gap = o.theirs - o.mine;
  const votes = `${gap} vote${gap === 1 ? "" : "s"}`;
  const subject = `${o.timeLeft} left: ${o.name} is ${votes} behind`;
  const html = layout({
    title: subject,
    preheader: `${o.name} ${o.mine} : ${o.theirs} ${o.opponent}. Still time to turn it around.`,
    body:
      eyebrow(`${o.roundName} · ${o.timeLeft} left`) +
      h1(`${votes}`, "to turn it around") +
      p(
        `${esc(o.name)} has <strong style="color:#fafaf9">${o.mine}</strong> and ${esc(o.opponent)} has <strong style="color:#fafaf9">${o.theirs}</strong>. ` +
          `The match closes in about ${esc(o.timeLeft)}. Close matches are usually decided in the final hours.`,
      ) +
      vs(`${o.name} · ${o.mine}`, `${o.opponent} · ${o.theirs}`) +
      button(o.shareUrl, "Share your matchup now") +
      panel(
        `<strong style="color:#fbbf24">Fastest way to ${votes}</strong><br>` +
          `Send the link directly to people who'd help you: friends, customers, your team. ` +
          `A personal message works better than a post. Voting is one click, no sign-up.`,
      ) +
      linkFallback(o.shareUrl),
    footer: "You're getting this because your website is playing in a Backlink Arena tournament.",
  });
  const text = `${o.timeLeft} left: ${o.name} ${o.mine} : ${o.theirs} ${o.opponent}.\n\nShare your matchup: ${o.shareUrl}\nRally kit: ${o.siteUrl}/dashboard`;
  return { subject, html, text };
}

/** About a day before qualifying ends, to free entries still fighting for a bracket spot. */
export function qualifyingEndingEmail(o: {
  name: string;
  tournament: string;
  rank: number;
  openSpots: number;
  inside: boolean;
  /** Inside: votes ahead of the first brand outside. Outside: votes needed to get in. */
  margin: number | null;
  votes: number;
  timeLeft: string;
  pageUrl: string;
  siteUrl: string;
}): Rendered {
  const v = (n: number) => `${n} vote${n === 1 ? "" : "s"}`;
  const subject = o.inside
    ? `${o.timeLeft} until the bracket: hold your spot`
    : `${o.timeLeft} until the bracket: ${o.name} needs ${v(o.margin ?? 1)}`;
  const standing = o.inside
    ? o.margin === null
      ? `${o.name} is #${o.rank} of the open spots, and there are more spots than brands right now.`
      : `${o.name} is #${o.rank}, inside the top ${o.openSpots} who get a bracket spot, ${v(o.margin)} ahead of the first brand outside.`
    : `${o.name} is #${o.rank}. The top ${o.openSpots} get a bracket spot, so you need ${v(o.margin ?? 1)} more to get in.`;
  const html = layout({
    title: subject,
    preheader: `Qualifying for ${o.tournament} ends in ${o.timeLeft}. ${o.name} has ${v(o.votes)}.`,
    body:
      eyebrow(`Qualifying ends in ${o.timeLeft}`) +
      h1(o.inside ? "Hold" : "Get into", o.inside ? "your spot" : "the bracket") +
      p(esc(standing)) +
      rows([
        ["Your rank", `#${o.rank}`],
        ["Your votes", String(o.votes)],
        ["Bracket spots left", String(o.openSpots)],
      ]) +
      button(o.pageUrl, "Share your page") +
      panel(
        RALLY_TIPS +
          `<br><br><strong style="color:#fbbf24">Skip qualifying next time</strong><br>Add our badge to your site, or take a guaranteed spot, from your <a href="${esc(`${o.siteUrl}/dashboard`)}" style="color:#fbbf24">dashboard</a>.`,
      ) +
      linkFallback(o.pageUrl),
    footer: "You're getting this because your website is entered in a Backlink Arena tournament.",
  });
  const text = `Qualifying for ${o.tournament} ends in ${o.timeLeft}.\n\n${standing}\n\nShare your page: ${o.pageUrl}\nDashboard: ${o.siteUrl}/dashboard`;
  return { subject, html, text };
}

/** To the champion when the final closes. */
export function winnerEmail(o: { name: string; tournament: string; siteUrl: string }): Rendered {
  const subject = `${o.name} won ${o.tournament}!`;
  const html = layout({
    title: subject,
    preheader: "You're the champion. Here's how you get your backlink.",
    body:
      eyebrow("Champion") +
      h1(o.name, "wins the arena") +
      p(`${esc(o.name)} won every matchup in <strong style="color:#fbbf24">${esc(o.tournament)}</strong>. Congratulations!`) +
      panel(
        `<strong style="color:#fbbf24">Your prize</strong><br>A backlink on a real DA 50+ website in your niche. We'll choose the site with you and place the link by hand. Reply to this email if you have a preference.`,
      ) +
      button(`${o.siteUrl}/winners`, "See the winners wall"),
    footer: "You're getting this because your website won a Backlink Arena tournament.",
  });
  const text = `${o.name} won ${o.tournament}! Congratulations.\n\nYour prize: a backlink on a real DA 50+ website in your niche. We'll choose the site with you and place it by hand. Reply to this email if you have a preference.\n\nWinners: ${o.siteUrl}/winners`;
  return { subject, html, text };
}

/** To every other entrant when the final closes. */
export function resultsEmail(o: { name: string; tournament: string; winnerName: string; siteUrl: string }): Rendered {
  const subject = `${o.tournament} is over: ${o.winnerName} wins`;
  const html = layout({
    title: subject,
    preheader: `${o.winnerName} is the champion. Thanks for playing.`,
    body:
      eyebrow("Tournament over") +
      h1(o.winnerName, "is the champion") +
      p(`The final of <strong style="color:#fbbf24">${esc(o.tournament)}</strong> is decided. Thanks for playing and sharing your matchups.`) +
      p(NEXT_LINE) +
      button(`${o.siteUrl}/dashboard`, "Open your dashboard") +
      p(`See every champion on <a href="${esc(`${o.siteUrl}/winners`)}" style="color:#fbbf24">the winners wall</a>.`, {
        muted: true,
        small: true,
      }),
    footer: "You're getting this because your website played in a Backlink Arena tournament.",
  });
  const text = `${o.tournament} is over: ${o.winnerName} is the champion.\n\n${NEXT_LINE}\n\nDashboard: ${o.siteUrl}/dashboard\nWinners: ${o.siteUrl}/winners`;
  return { subject, html, text };
}
