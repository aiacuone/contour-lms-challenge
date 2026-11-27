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
      <div className="mx-auto flex max-w-4xl flex-wrap items-center gap-x-6 gap-y-2 px-4 py-3 sm:px-6">
        <span className="font-semibold">Consultations</span>
        {/* Students have only their own page, so they get no nav. On a phone
            the nav moves to a second row. */}
        {isAdmin && (
          <nav
            aria-label="Main"
            className="order-last flex basis-full gap-4 text-sm sm:order-none sm:basis-auto"
          >
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
        <span className="ml-auto min-w-0 flex-1 truncate text-right text-sm text-muted-foreground sm:flex-none">
          {email}
        </span>
        <LogoutButton />
      </div>
    </header>
  );
}
