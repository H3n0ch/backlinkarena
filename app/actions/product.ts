"use server";

import { refresh } from "next/cache";
import { z } from "zod";
import { getUser } from "@/lib/auth";
import { createSupabasePublic, createSupabaseServer } from "@/lib/supabase/server";
import type { ActionResult } from "@/lib/types";
import { safeHttpUrl } from "@/lib/url";
import { friendlyDbError } from "./errors";

const Edit = z.object({
  name: z.string().trim().min(1).max(80),
  description: z.string().trim().max(300),
  logoUrl: z.string().trim().max(1000),
});

export async function updateProduct(productId: string, input: z.input<typeof Edit>): Promise<ActionResult> {
  const user = await getUser();
  if (!user) return { ok: false, error: "Please log in first." };
  const parsed = Edit.safeParse(input);
  if (!parsed.success) return { ok: false, error: "Please check the fields." };
  const supabase = await createSupabaseServer();
  const { error } = await supabase
    .from("products")
    .update({
      name: parsed.data.name,
      description: parsed.data.description || null,
      logo_url: safeHttpUrl(parsed.data.logoUrl),
    })
    .eq("id", productId)
    .eq("owner_id", user.id);
  if (error) return { ok: false, error: friendlyDbError(error, "") };
  refresh();
  return { ok: true, message: "Saved." };
}

const Waitlist = z.object({
  email: z.email().max(200),
  website: z.string().trim().max(300).optional().default(""),
});

export async function joinWaitlist(input: z.input<typeof Waitlist>): Promise<ActionResult> {
  const parsed = Waitlist.safeParse(input);
  if (!parsed.success) return { ok: false, error: "Please enter a valid email." };
  const db = createSupabasePublic();
  const { error } = await db
    .from("waitlist")
    .insert({ email: parsed.data.email.toLowerCase(), website: parsed.data.website || null });
  if (error && error.code !== "23505") return { ok: false, error: "Could not join the waitlist." };
  return { ok: true, message: "You're on the list. We'll email you when the next tournament opens." };
}
