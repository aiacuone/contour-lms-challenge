import { AppHeader } from "@/components/app-header";
import { ConsultationsPanel } from "@/components/consultations/consultations-panel";

// The student dashboard. The list loads in the browser from the API, so the
// loading and error states show; see docs/wireframes/dashboard.html.
// AppHeader sends logged-out visitors to Log in.
export default function DashboardPage() {
  return (
    <div className="flex min-h-screen flex-col">
      <AppHeader current="/dashboard" />
      <main className="mx-auto flex w-full max-w-4xl flex-col gap-6 px-4 py-6 sm:px-6 sm:py-8">
        <ConsultationsPanel />
      </main>
    </div>
  );
}
