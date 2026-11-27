// A light, in-memory rate limit for the API: a fixed window per key (the
// logged-in user's id, or the client's IP when logged out).
//
// Trade-off: the counts live in this server's memory, so they reset on restart
// and are not shared between servers. A shared store such as Redis would be
// needed for more than one instance; see the README.

export type RateLimitResult =
  { ok: true } | { ok: false; retryAfterSeconds: number };

type Window = { start: number; count: number };

export function createRateLimiter({
  limit,
  windowMs,
  now = Date.now,
}: {
  limit: number;
  windowMs: number;
  now?: () => number;
}) {
  const windows = new Map<string, Window>();

  return function check(key: string): RateLimitResult {
    const time = now();
    const current = windows.get(key);

    if (!current || time - current.start >= windowMs) {
      // Drop expired windows now and then, so the map cannot grow forever.
      if (windows.size > 10_000) {
        for (const [k, w] of windows) {
          if (time - w.start >= windowMs) windows.delete(k);
        }
      }
      windows.set(key, { start: time, count: 1 });
      return { ok: true };
    }

    current.count += 1;
    if (current.count <= limit) return { ok: true };
    return {
      ok: false,
      retryAfterSeconds: Math.ceil((current.start + windowMs - time) / 1000),
    };
  };
}

// 60 API requests a minute per user or IP: far above what the app's screens
// make, low enough to slow a script hammering the API.
export const apiRateLimit = createRateLimiter({ limit: 60, windowMs: 60_000 });
