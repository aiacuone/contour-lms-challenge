// Date and time helpers for the browser. Times are shown and entered in the
// browser's time zone and sent to the API as ISO strings in UTC.

const dateFormat = new Intl.DateTimeFormat("en-AU", {
  weekday: "short",
  day: "numeric",
  month: "short",
});
const timeFormat = new Intl.DateTimeFormat("en-AU", {
  hour: "numeric",
  minute: "2-digit",
});

// For example "Mon 30 Nov, 3:00 pm".
export function formatDateTime(iso: string): string {
  const date = new Date(iso);
  const day = dateFormat.format(date).replace(",", "");
  return `${day}, ${timeFormat.format(date)}`;
}

// The value a datetime-local input expects, for example "2026-11-30T15:00".
export function toLocalInput(date: Date): string {
  const pad = (n: number) => String(n).padStart(2, "0");
  return (
    `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}` +
    `T${pad(date.getHours())}:${pad(date.getMinutes())}`
  );
}

// A datetime-local value read as local time, as an ISO string, or "" if empty.
export function fromLocalInput(value: string): string {
  if (!value) return "";
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? "" : date.toISOString();
}
