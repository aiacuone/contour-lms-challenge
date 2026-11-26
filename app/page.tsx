import { Button } from "@/components/ui/button";

export default function Home() {
  return (
    <main className="mx-auto flex min-h-screen max-w-xl flex-col items-start justify-center gap-4 p-8">
      <h1 className="text-3xl font-semibold">Consultations</h1>
      <p className="text-muted-foreground">
        A mini learning management system for booking and managing
        consultations.
      </p>
      <Button>Get started</Button>
    </main>
  );
}
