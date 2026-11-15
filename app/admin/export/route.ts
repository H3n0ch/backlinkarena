import { NextResponse, type NextRequest } from "next/server";
import { getUser } from "@/lib/auth";
import { createSupabaseAdmin } from "@/lib/supabase/admin";

function csvCell(v: unknown): string {
  let s = v == null ? "" : String(v);
  // Neutralise spreadsheet formula injection.
  if (/^[=+\-@\t\r]/.test(s)) s = `'${s}`;
  return /[",\n\r]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}

/** CSV of every non-winning participant of a tournament (default: the current one). */
export async function GET(request: NextRequest) {
  const user = await getUser();
  if (!user?.isAdmin) return new NextResponse("Not found", { status: 404 });

  const db = createSupabaseAdmin();
  const requested = request.nextUrl.searchParams.get("tournament");
  const query = db.from("tournaments").select("id, name, winner_product_id, status");
  const { data: t } = requested
    ? await query.eq("id", requested).maybeSingle()
    : await query.order("created_at", { ascending: false }).limit(1).maybeSingle();
  if (!t) return new NextResponse("No tournament", { status: 404 });

  const { data: rows } = await db
    .from("entries")
    .select("product_id, entry_path, eliminated_round, products(domain, category, url, owner_id, profiles(email, full_name))")
    .eq("tournament_id", t.id);

  type Row = {
    product_id: string;
    entry_path: string;
    eliminated_round: number | null;
    products: {
      domain: string;
      category: string | null;
      owner_id: string;
      profiles: { email: string | null; full_name: string | null } | null;
    } | null;
  };

  // Losers: everyone except the winner. While a tournament is still running, only those already out.
  const losers = ((rows ?? []) as unknown as Row[]).filter((r) =>
    t.status === "finished" ? r.product_id !== t.winner_product_id : r.eliminated_round !== null,
  );

  const lines = [
    ["email", "name", "domain", "category", "entry_path", "eliminated_round"].join(","),
    ...losers.map((r) =>
      [r.products?.profiles?.email, r.products?.profiles?.full_name, r.products?.domain, r.products?.category, r.entry_path, r.eliminated_round]
        .map(csvCell)
        .join(","),
    ),
  ];
  const filename = `losers-${t.name.toLowerCase().replace(/[^a-z0-9]+/g, "-")}.csv`;
  return new NextResponse(lines.join("\n"), {
    headers: {
      "content-type": "text/csv; charset=utf-8",
      "content-disposition": `attachment; filename="${filename}"`,
      "cache-control": "no-store",
    },
  });
}
