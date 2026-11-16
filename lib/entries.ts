import "server-only";
import type { createSupabaseAdmin } from "@/lib/supabase/admin";
import type { EntryPath } from "@/lib/types";

type Admin = ReturnType<typeof createSupabaseAdmin>;

/**
 * Lets a product skip qualifying in the open (draft / qualifying) tournament:
 * upgrades its free entry to `path`, or creates the entry if it has none.
 * Returns the tournament name if it applied, null if no tournament is open for entries.
 */
export async function skipQualifying(db: Admin, productId: string, path: EntryPath): Promise<string | null> {
  const { data: t } = await db
    .from("tournaments")
    .select("id, name")
    .in("status", ["draft", "qualifying"])
    .maybeSingle();
  if (!t) return null;
  const { data: entry } = await db
    .from("entries")
    .select("id, entry_path")
    .eq("tournament_id", t.id)
    .eq("product_id", productId)
    .maybeSingle();
  if (entry && entry.entry_path === "free") {
    await db.from("entries").update({ entry_path: path }).eq("id", entry.id);
  } else if (!entry) {
    await db.from("entries").insert({ tournament_id: t.id, product_id: productId, entry_path: path });
  }
  return t.name as string;
}

/**
 * Gives a product one Contender Pass. If a tournament is open for entries it goes straight
 * in (skips qualifying); otherwise it waits in the queue and is entered automatically when
 * the next tournament is created. The pass is used up once the brand gets a bracket spot.
 * Returns the tournament name it was entered into, or null if it is queued.
 */
export async function grantPass(db: Admin, productId: string): Promise<{ ok: boolean; tournament: string | null }> {
  const { error } = await db.from("products").update({ pass_paid: true }).eq("id", productId);
  if (error) return { ok: false, tournament: null };
  return { ok: true, tournament: await skipQualifying(db, productId, "pass") };
}
