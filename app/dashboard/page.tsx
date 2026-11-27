import { redirect } from "next/navigation";

import { ConsultationsPanel } from "@/components/consultations/consultations-panel";
import { LogoutButton } from "@/components/logout-button";
import { Button } from "@/components/ui/button";
import { createClient } from "@/lib/supabase/server";

// The student dashboard. The list loads in the browser from the API, so the
// loading and error states show; see docs/wireframes/dashboard.html.
export default async function DashboardPage() {
  const supabase = await createClient();
  const { data } = await supabase.auth.getClaims();
  if (!data?.claims) redirect("/auth/login");
  const email = data.claims.email;

  return (
    <div className="flex min-h-screen flex-col">
      <header className="border-b">
        <div className="mx-auto flex max-w-4xl items-center gap-4 px-6 py-3">
          <span className="flex-1 font-semibold">Consultations</span>
          <span className="text-sm text-muted-foreground">{email}</span>
          <LogoutButton />
        </div>
      </header>
      <main className="mx-auto flex w-full max-w-4xl flex-col gap-6 px-6 py-8">
        <div className="flex items-center gap-4">
          <h1 className="flex-1 text-2xl font-semibold">My consultations</h1>
          {/* Stand-in: the booking dialog is added in #12. */}
          <Button disabled>Book consultation</Button>
        </div>
        <ConsultationsPanel />
      </main>
    </div>
  );
}
