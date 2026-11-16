import type { EmailOtpType } from "@supabase/supabase-js";
import { NextResponse, type NextRequest } from "next/server";
import { createSupabaseServer } from "@/lib/supabase/server";
import { safeNext } from "@/lib/url";

/** Why a login link didn't work. Shown as a plain message on /login. */
type Reason = "used" | "expired" | "browser" | "provider" | "failed";

function reasonOf(code: string | null | undefined, message = ""): Reason {
  if (code === "flow_state_not_found") return "used";
  if (code === "otp_expired" || code === "flow_state_expired") return "expired";
  if (code === "bad_code_verifier" || /code verifier/i.test(message)) return "browser";
  // Google (or another provider) rejected our server: usually a wrong client secret or redirect URI.
  if (/external (code|provider)|oauth|client secret|redirect_uri/i.test(message)) return "provider";
  return "failed";
}

/**
 * Email links and Google OAuth land here.
 * - `token_hash` (email links): verified on the server, so the link works in any browser or device.
 * - `code` (Google OAuth, old-style email links): PKCE, only works in the browser that started the login.
 */
export async function GET(request: NextRequest) {
  const { searchParams, origin } = request.nextUrl;
  const next = safeNext(searchParams.get("next"));
  const supabase = await createSupabaseServer();
  const ok = () => NextResponse.redirect(new URL(next, origin));

  let reason: Reason = reasonOf(searchParams.get("error_code"), searchParams.get("error_description") ?? "");
  if (searchParams.get("error")) {
    // Supabase sends provider failures back as ?error=…&error_description=… (no code).
    console.error(
      "auth callback: provider returned an error",
      searchParams.get("error"),
      searchParams.get("error_code"),
      searchParams.get("error_description"),
    );
  }
  const tokenHash = searchParams.get("token_hash");
  const code = searchParams.get("code");

  if (tokenHash) {
    const t = searchParams.get("type");
    const type: EmailOtpType = t === "recovery" || t === "email_change" ? t : "email";
    const { error } = await supabase.auth.verifyOtp({ type, token_hash: tokenHash });
    if (!error) return ok();
    console.error("auth callback: verifyOtp failed", error.code, error.message);
    // A used or expired token_hash both come back as otp_expired.
    reason = error.code === "otp_expired" ? "expired" : reasonOf(error.code, error.message);
  } else if (code) {
    const { error } = await supabase.auth.exchangeCodeForSession(code);
    if (!error) return ok();
    console.error("auth callback: exchangeCodeForSession failed", error.code, error.message);
    reason = reasonOf(error.code, error.message);
  }

  // Link clicked twice, or logged in another way meanwhile: they're in, so just continue.
  const { data } = await supabase.auth.getUser();
  if (data.user) return ok();

  return NextResponse.redirect(new URL(`/login?error=${reason}&next=${encodeURIComponent(next)}`, origin));
}
