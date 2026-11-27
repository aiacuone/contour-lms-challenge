import { describe, expect, it } from "vitest";

import { createRateLimiter } from "@/lib/api/rate-limit";

describe("rate limiter", () => {
  function setup() {
    let time = 0;
    const check = createRateLimiter({
      limit: 3,
      windowMs: 60_000,
      now: () => time,
    });
    return { check, advance: (ms: number) => (time += ms) };
  }

  it("allows up to the limit, then refuses with the time left", () => {
    const { check, advance } = setup();
    expect([check("a"), check("a"), check("a")]).toEqual([
      { ok: true },
      { ok: true },
      { ok: true },
    ]);
    advance(20_000);
    expect(check("a")).toEqual({ ok: false, retryAfterSeconds: 40 });
  });

  it("counts each key separately", () => {
    const { check } = setup();
    check("a");
    check("a");
    check("a");
    expect(check("a").ok).toBe(false);
    expect(check("b").ok).toBe(true);
  });

  it("starts a new window once the old one ends", () => {
    const { check, advance } = setup();
    for (let i = 0; i < 4; i++) check("a");
    advance(60_000);
    expect(check("a")).toEqual({ ok: true });
  });
});
