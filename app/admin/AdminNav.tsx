import Link from "next/link";
import { lockAdmin } from "@/app/actions/admin-auth";

const LINKS = [
  { href: "/admin", label: "Overview" },
  { href: "/admin/tournaments", label: "Tournaments & bracket" },
  { href: "/admin/products", label: "Sites" },
  { href: "/admin/votes", label: "Votes" },
  { href: "/admin/users", label: "Users" },
  { href: "/admin/leads", label: "Leads" },
  { href: "/admin/settings", label: "Homepage numbers" },
] as const;

/** Rendered by each admin page after requireAdmin(), so non-admins never see it. */
export function AdminNav({ current }: { current: (typeof LINKS)[number]["href"] }) {
  return (
    <nav className="mb-8 flex flex-wrap gap-2">
      {LINKS.map((l) => (
        <Link
          key={l.href}
          href={l.href}
          className={`btn text-sm ${l.href === current ? "bg-ink text-white" : "bg-card"}`}
        >
          {l.label}
        </Link>
      ))}
      <form action={lockAdmin} className="ml-auto">
        <button className="btn bg-card text-sm">Lock admin 🔒</button>
      </form>
    </nav>
  );
}
