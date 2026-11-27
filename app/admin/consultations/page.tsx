import { AdminConsultationsTable } from "@/components/admin/admin-consultations-table";
import { AppHeader } from "@/components/app-header";

// Every student's consultations, read-only. The table loads from
// GET /api/admin/consultations, which decides access: a student sees the
// forbidden view. See docs/wireframes/admin-list.html and admin403.html.
export default function AdminConsultationsPage() {
  return (
    <div className="flex min-h-screen flex-col">
      <AppHeader current="/admin/consultations" />
      <main className="mx-auto flex w-full max-w-4xl flex-col gap-6 px-4 py-6 sm:px-6 sm:py-8">
        <AdminConsultationsTable />
      </main>
    </div>
  );
}
