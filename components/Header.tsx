import Link from "next/link";
import { Suspense } from "react";
import { getUser } from "@/lib/auth";
import { Wordmark } from "./Logo";

const NAV = [
  { href: "/arena", label: "Arena" },
  { href: "/#pricing", label: "Pricing" },
  { href: "/services", label: "Services" },
  { href: "/winners", label: "Winners" },
  { href: "/#faq", label: "FAQ" },
];

export function Header() {
  return (
    <header className="sticky top-0 z-20 bg-white/75 backdrop-blur-md">
      <div className="mx-auto grid max-w-6xl grid-cols-[1fr_auto] items-center gap-3 px-4 py-3 md:grid-cols-[1fr_auto_1fr]">
        <Link href="/" aria-label="Backlink Arena home" className="justify-self-start">
          <Wordmark />
        </Link>
        <nav className="hidden items-center gap-6 text-sm font-medium text-muted md:flex">
          {NAV.map((n) => (
            <Link key={n.href} href={n.href} className="hover:text-ink">
              {n.label}
            </Link>
          ))}
        </nav>
        <div className="flex items-center justify-self-end gap-2">
          <Link href="/arena" className="text-sm font-semibold md:hidden">
            Arena
          </Link>
          <Suspense fallback={<span className="w-16" />}>
            <UserLink />
          </Suspense>
          <Link href="/join" className="btn border-red bg-red py-1.5! px-3! text-sm text-white">
            Enter
          </Link>
        </div>
      </div>
      <div aria-hidden="true" className="line-gradient opacity-60" />
    </header>
  );
}

async function UserLink() {
  const user = await getUser();
  if (!user) {
    return (
      <Link href="/login" className="px-2 text-sm font-semibold text-muted hover:text-ink">
        Log in
      </Link>
    );
  }
  return (
    <>
      {user.isAdminAccount && (
        <Link href="/admin" className="px-2 text-sm font-semibold text-muted hover:text-ink">
          Admin
        </Link>
      )}
      <Link href="/dashboard" className="px-2 text-sm font-semibold text-muted hover:text-ink">
        Dashboard
      </Link>
    </>
  );
}
