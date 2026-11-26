import { redirect } from "next/navigation";

import { LogoutButton } from "@/components/logout-button";
import { createClient } from "@/lib/supabase/server";

// Stand-in until the student dashboard (#11) replaces this page.
export default async function DashboardPage() {
  const supabase = await createClient();
  const { data } = await supabase.auth.getClaims();
  const email = data?.claims?.email;

  if (!data?.claims) redirect("/auth/login");

  return (
    <main className="mx-auto flex min-h-screen max-w-3xl flex-col gap-6 p-8">
      <header className="flex items-center gap-4">
        <h1 className="flex-1 text-2xl font-semibold">My consultations</h1>
        <span className="text-sm text-muted-foreground">{email}</span>
        <LogoutButton />
      </header>
      <p className="text-muted-foreground">
        You are logged in. Your consultations will appear here.
      </p>
    </main>
  );
}
