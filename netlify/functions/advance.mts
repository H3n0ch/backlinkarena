import type { Config } from "@netlify/functions";

/**
 * Every 5 minutes: close ended matches, set winners, create the next round,
 * seed the bracket when qualifying ends. All logic lives in the idempotent
 * Postgres function `advance_tournaments()`, so running it twice is safe.
 */
export default async function advance() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) {
    console.error("advance: missing Supabase env vars");
    return new Response("missing env", { status: 500 });
  }

  // New "sb_secret_..." keys go in the apikey header only; legacy JWT service_role keys also as Bearer.
  const headers: Record<string, string> = { apikey: key, "content-type": "application/json" };
  if (key.startsWith("eyJ")) headers.authorization = `Bearer ${key}`;

  const res = await fetch(`${url}/rest/v1/rpc/advance_tournaments`, {
    method: "POST",
    headers,
    body: "{}",
  });
  const body = await res.text();
  if (!res.ok) {
    console.error("advance failed", res.status, body);
    return new Response(body, { status: 500 });
  }
  console.log("advance ok", body);
  return new Response(body);
}

export const config: Config = {
  schedule: "*/5 * * * *",
};
