"use server";

import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { ADMIN_COOKIE, adminPasswordConfigured, checkAdminPassword, makeAdminToken } from "@/lib/admin-password";
import { getUser } from "@/lib/auth";
import type { ActionResult } from "@/lib/types";

export async function unlockAdmin(password: string): Promise<ActionResult> {
  const user = await getUser();
  if (!user?.isAdminAccount) return { ok: false, error: "Not allowed." };
  if (!adminPasswordConfigured()) {
    return { ok: false, error: "ADMIN_PASSWORD is not set on the server. Add it to the environment variables." };
  }
  if (typeof password !== "string" || !checkAdminPassword(password)) {
    // Slow down guessing.
    await new Promise((r) => setTimeout(r, 1500));
    return { ok: false, error: "Wrong password." };
  }
  const token = makeAdminToken(user.id)!;
  (await cookies()).set(ADMIN_COOKIE, token.value, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "strict",
    path: "/",
    maxAge: token.maxAge,
  });
  redirect("/admin");
}

export async function lockAdmin(): Promise<void> {
  (await cookies()).delete(ADMIN_COOKIE);
  redirect("/");
}
