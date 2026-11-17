# Backlink Arena

**A 1v1 voting tournament for founders' websites. The champion wins a backlink on a real DA 50+ site in their niche.**

Strong backlinks usually cost real money. Backlink Arena turns them into a game: brands enter their website, get paired in 1v1 matchups and rally their audience to vote. Every brand shares its matchup to win, and every share shows **both** sites, so even the losing side gets seen by people who've never heard of it. Voting is one click and needs no account.

The business side: losing brands get a time-limited discount on our paid backlink services, and every matchup page sends traffic and leads.

---

## How a tournament works

| Phase | What happens |
|---|---|
| **Draft** | The admin creates the tournament (name, bracket of 8 or 16, match length, qualifying end). |
| **Qualifying** | Brands enter. **Free** entries collect votes on a public leaderboard. **Badge** entries (our badge verified on their site) and **Pass** entries ($79 guaranteed spot via Stripe) skip qualifying. |
| **Bracket** | When qualifying ends with a full field, the bracket locks: seats placed by the admin stay, empty seats fill with pass/badge first, then the most-voted free entries. Round 1 pairs seat 1 v 2, 3 v 4… If the field isn't full, qualifying extends 24h at a time. |
| **Matches** | Each match runs for a set time (default 24h). Visitors vote once per matchup; the brand with more votes advances. Winners meet winners. |
| **Finished** | The champion's backlink is placed by hand and listed on `/winners`. Everyone else gets 30% off our services for 7 days, plus their exposure stats. |

Brands are never paired with a direct competitor.

## Features

**For brands**
- **Join flow** (`/join`): paste a URL, we pull the name, description and logo, then save after login.
- **Dashboard** (`/dashboard`): status per site, exposure stats (views, clicks, votes), badge code, $79 checkout, and a **Rally kit** with ready-to-post texts per channel, one-click share buttons and a downloadable matchup image. Several sites show side by side in a carousel.
- **Public pages**: brand page `/p/[slug]`, matchup pages `/match/[id]` and `/vs/[a]-vs-[b]`, each with a generated share image (`opengraph-image`).
- **Login**: magic link (works on any device) and Google.

**For voters**
- One-click voting with no account (guest votes tied to a browser cookie, with per-network limits).

**For the admin** (`/admin`, admin account + `ADMIN_PASSWORD`)
- **Control room**: place brands into seats, auto-fill, start the bracket, pause/resume/stop, disqualify/reinstate, run the engine now.
- **CRM**: edit tournaments, matches (including manual vote adjustments), products, entries, users and votes; verify badges; mark passes paid; CSV export.
- **Leads**: requests from "Talk to us" and the participant offer, with status tracking.

**Email** (Resend): welcome email when a site joins, lead notification to the admin, and a confirmation to the lead. Login and signup emails are sent by Supabase using our branded templates.

## Tech stack

- **Next.js 16** (App Router, Cache Components, Server Actions, `proxy.ts`), **React 19**, **Tailwind CSS 4**
- **Supabase**: Postgres, Auth, Row Level Security. The tournament logic lives in the database.
- **Netlify**: hosting, plus a scheduled function that runs the engine every 5 minutes
- **Stripe** for the $79 pass, **Resend** for email, **zod** for validation, **vitest** for tests

## Project structure

```
app/                  Pages and routes (App Router)
  actions/            Server actions: join, vote, badge, pass, leads, admin, CRM, control room
  admin/              Admin panel: control room, CRM, leads, settings
  api/                Stripe webhook, vote counts, tracking, badge endpoints
  auth/callback/      Login callback (email token_hash + Google OAuth)
  match/ vs/ p/       Public matchup and brand pages (+ share images)
components/           UI: matchup cards, bracket, carousel, Rally kit, share buttons…
lib/                  Data access, auth, env, URLs, Stripe, email
  email-layout.ts     Email design system (dark + gold)
  email-templates.ts  Every email we send
  og-card.tsx         Matchup share image
netlify/functions/    advance.mts: scheduled engine run every 5 minutes
scripts/              build-email-templates.mts (generates the Supabase templates)
supabase/
  migrations/         0001–0010, run in order
  templates/          Generated Supabase auth email templates
  tests/              integrity.sql
```

## How it works under the hood

- **The engine** is the Postgres function `advance_tournaments()`. It seeds the bracket when qualifying ends, closes ended matches, creates the next round and finishes the tournament. It is idempotent: the Netlify job calls it every 5 minutes, and so do the admin buttons.
- **Vote integrity is enforced in the database.** Triggers check the voting window, that voters don't vote for their own brand, that the brand is in the match, pauses and rate limits. Guest votes are only written by the server. Public counts come from RPCs (`match_counts`, `tournament_match_counts`, `qualifying_leaderboard`), so voter identities stay private.
- **Admin vote adjustments** are stored separately (`a_adjust`, `b_adjust`, `vote_adjust`) and added to the real count everywhere, including when the engine picks a winner.
- **Admin writes** go through server actions that check the admin account and password, then use the service-role key (server only).

---

## Setup

### 1. Supabase

1. Create a project at supabase.com.
2. In the SQL Editor, run every file in [`supabase/migrations/`](supabase/migrations/) **in order** (0001 → 0010). They are safe to re-run.
3. Optional: run [`supabase/tests/integrity.sql`](supabase/tests/integrity.sql). It rolls back, and the last row should read `ALL CHECKS PASSED`.
4. **Authentication → Sign In / Providers**
   - **Email**: on.
   - **Google**: on, with the Client ID and secret from a Google Cloud OAuth client. In Google Cloud, set the authorized redirect URI to `https://YOUR-PROJECT.supabase.co/auth/v1/callback`, and add your site (and `http://localhost:3000`) as JavaScript origins.
5. **Authentication → URL Configuration**
   - Site URL: your live domain
   - Redirect URLs: `https://YOUR-DOMAIN/**` and `http://localhost:3000/**`
6. **Authentication → Email Templates**: paste [`confirm-signup.html`](supabase/templates/confirm-signup.html) and [`magic-link.html`](supabase/templates/magic-link.html). The subject line for each is at the top of its file. These links use `token_hash`, so they work in any browser or on any device.
7. **Authentication → Emails → SMTP Settings**: use Resend (host `smtp.resend.com`, port `465`, user `resend`, password = your Resend API key, sender on your verified domain). Then raise the email rate limit under **Rate Limits**. The built-in mailer only sends a few emails per hour, and only to team members.
8. Make yourself admin after logging in once:
   ```sql
   update profiles set is_admin = true where email = 'you@example.com';
   ```

### 2. Resend

Verify your sending domain at resend.com/domains (add the DNS records it shows) and create a **sending-only** API key. Until a domain is verified, Resend only delivers to your own account address.

### 3. Local development

```bash
cp .env.local.example .env.local   # fill in the values (see below)
npm install
npm run dev                        # http://localhost:3000
```

The scheduled engine doesn't run locally. Use **/admin → Run scheduled job now**.

### 4. Netlify

1. Import the repo. Netlify detects Next.js automatically.
2. Set the environment variables below, with `NEXT_PUBLIC_SITE_URL` set to your live domain.
3. Deploy and add your custom domain.
4. `netlify/functions/advance.mts` runs every 5 minutes. Check it under **Functions → advance → logs**. Scheduled functions only run on published production deploys.

### Environment variables

See [`.env.local.example`](.env.local.example) for details.

| Variable | Needed for |
|---|---|
| `NEXT_PUBLIC_SITE_URL` | Links in shares and emails (`http://localhost:3000` locally) |
| `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` | Supabase (public) |
| `SUPABASE_SERVICE_ROLE_KEY` | Server-side admin writes, guest votes, stats (**secret**) |
| `ADMIN_PASSWORD` | Second factor for `/admin` |
| `NEXT_PUBLIC_CONTACT_EMAIL` | Contact links; fallback for admin notifications |
| `NEXT_PUBLIC_GOOGLE_CLIENT_ID` | Google sign-in (same client as in Supabase) |
| `STRIPE_SECRET_KEY`, `STRIPE_WEBHOOK_SECRET`, `STRIPE_PASS_PRICE_ID` | $79 guaranteed spot. Without them the buy button shows "Coming soon" |
| `RESEND_API_KEY`, `EMAIL_FROM`, `ADMIN_EMAIL` | App emails. Without the key emails are skipped and nothing breaks |
| `PUBLIC_SITE_URL` | Optional: address inside badge codes (defaults to the Netlify URL) |

## Running a tournament (admin checklist)

1. **Create** the tournament in `/admin/tournaments`: name, bracket size, match hours, qualifying end. Paid and badge brands are entered automatically.
2. During qualifying: **verify badges**, **mark passes paid** (for manual payments), add signed-up brands to the tournament, and place seats in the control room. Avoid pairing direct competitors.
3. The bracket **starts automatically** when qualifying ends with a full field, or use **Start bracket now**.
4. During the bracket: matches close and advance on their own. Use pause, disqualify or vote adjustments only when needed.
5. **After the final:** place the winner's backlink, paste its URL under "Finished tournaments", and follow up on leads from the participant offer.

Rules and privacy text: [`app/rules/page.tsx`](app/rules/page.tsx) and [`app/privacy/page.tsx`](app/privacy/page.tsx).

## Scripts

| Command | What it does |
|---|---|
| `npm run dev` | Dev server |
| `npm run build` / `npm start` | Production build / serve |
| `npm run lint` | ESLint |
| `npm test` | Unit tests (vitest) |
| `npm run emails:build` | Regenerates the Supabase email templates from `lib/email-templates.ts` |
