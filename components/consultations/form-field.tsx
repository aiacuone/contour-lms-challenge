import { Label } from "@/components/ui/label";

// A label, its control and its first error message, linked for screen readers.
// The control must use the same id and set aria-describedby={errorId(id)}
// when there is an error.

export function errorId(id: string): string {
  return `${id}-error`;
}

export function FormField({
  id,
  label,
  error,
  children,
}: {
  id: string;
  label: string;
  error?: string;
  children: React.ReactNode;
}) {
  return (
    <div className="flex flex-col gap-1.5">
      <Label htmlFor={id}>{label}</Label>
      {children}
      {error && (
        <p id={errorId(id)} className="text-sm text-destructive">
          {error}
        </p>
      )}
    </div>
  );
}

// Props that mark a control invalid and point it at its error message.
export function invalidProps(id: string, error?: string) {
  return error ? { "aria-invalid": true, "aria-describedby": errorId(id) } : {};
}
