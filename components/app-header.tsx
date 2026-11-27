import Link from "next/link";
import { redirect } from "next/navigation";

import { cn } from "cn";

import { LogoutButton } from "@/components/logout-button";
import { createClient } from "@/lib/supabase/server";

// The header on every logged-in page. The "All consultations" link shows only
// to admins; the admin page and API check the role again for themselves.

const links = [
  { href: "/dashboard", label: "My consultations" },
  { href: "/admin/consultations", label: "All consultations" },
] as const;

export async function AppHeader({ current }: { current: string }) {
  const supabase = await createClient();
  const { data } = await supabase.auth.getClaims();
  if (!data?.claims) redirect("/auth/login");
  const email = data.claims.email;

  // A failed check just hides the link.
  const { data: isAdmin } = await supabase.rpc("is_admin");

  return (
    <header className="border-b">
      <div className="mx-auto flex max-w-4xl items-center gap-6 px-6 py-3">
        <span className="font-semibold">Consultations</span>
        {/* Students have only their own page, so they get no nav. */}
        {isAdmin && (
          <nav aria-label="Main" className="flex gap-4 text-sm">
            {links.map((link) => (
              <Link
                key={link.href}
                href={link.href}
                aria-current={link.href === current ? "page" : undefined}
                className={cn(
                  "text-muted-foreground hover:text-foreground",
                  link.href === current && "font-medium text-foreground",
                )}
              >
                {link.label}
              </Link>
            ))}
          </nav>
        )}
        <span className="ml-auto text-sm text-muted-foreground">{email}</span>
        <LogoutButton />
      </div>
    </header>
  );
}
