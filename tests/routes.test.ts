import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";

import type { DbClient } from "@/lib/supabase/server";

import {
  cleanUp,
  clientsForAll,
  daysFromNow,
  makeConsultation,
  readRow,
  TEST_REASON,
  type UserName,
  USERS,
} from "./support";

// The API routes, called as each seeded user. The handlers run as they do in
// Next.js; only the cookie-based Supabase client is swapped for one logged in
// as the test's user, so every check (guards, rules, RLS) is the real one.

const session = vi.hoisted(() => ({ client: null as DbClient | null }));
vi.mock("@/lib/supabase/server", () => ({
  createClient: async () => session.client,
}));

const list = await import("@/app/api/consultations/route");
const reschedule =
  await import("@/app/api/consultations/[id]/reschedule/route");
const cancel = await import("@/app/api/consultations/[id]/cancel/route");
const complete = await import("@/app/api/consultations/[id]/complete/route");
const admin = await import("@/app/api/admin/consultations/route");

let as: Record<UserName, DbClient>;

beforeAll(async () => {
  as = await clientsForAll();
});

afterAll(cleanUp);

type Handler = (
  request: Request,
  context: { params: Promise<{ id: string }> },
) => Promise<Response>;

// Calls a route handler as a user and returns its status and JSON body.
async function call(
  user: UserName,
  handler: Handler,
  { id = "", body }: { id?: string; body?: unknown } = {},
) {
  session.client = as[user];
  const request = new Request("http://localhost/api", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  const response = await handler(request, { params: Promise.resolve({ id }) });
  return { status: response.status, body: await response.json() };
}

const get = (handler: () => Promise<Response>) => handler as unknown as Handler;

const booking = {
  firstName: "Mia",
  lastName: "Test",
  reason: TEST_REASON,
  scheduledAt: daysFromNow(3),
};

// Every route, with a valid request, so only access decides the answer.
const routes = {
  "GET /api/consultations": async (user: UserName) => call(user, get(list.GET)),
  "POST /api/consultations": async (user: UserName) =>
    call(user, list.POST, { body: booking }),
  "POST reschedule": async (user: UserName) =>
    call(user, reschedule.POST, {
      id: await makeConsultation("mia"),
      body: { scheduledAt: daysFromNow(9) },
    }),
  "POST cancel": async (user: UserName) =>
    call(user, cancel.POST, { id: await makeConsultation("mia") }),
  "POST complete": async (user: UserName) =>
    call(user, complete.POST, {
      id: await makeConsultation("mia"),
      body: { completed: true },
    }),
  "GET /api/admin/consultations": async (user: UserName) =>
    call(user, get(admin.GET)),
};

describe("access matrix", () => {
  // Expected status for each route and user. The action routes act on one of
  // Mia's booked consultations.
  const matrix: Record<keyof typeof routes, Record<UserName, number>> = {
    "GET /api/consultations": { anon: 401, mia: 200, sam: 200, admin: 200 },
    "POST /api/consultations": { anon: 401, mia: 201, sam: 201, admin: 201 },
    "POST reschedule": { anon: 401, mia: 200, sam: 404, admin: 404 },
    "POST cancel": { anon: 401, mia: 200, sam: 404, admin: 404 },
    "POST complete": { anon: 401, mia: 200, sam: 404, admin: 404 },
    "GET /api/admin/consultations": {
      anon: 401,
      mia: 403,
      sam: 403,
      admin: 200,
    },
  };

  const cells = Object.entries(matrix).flatMap(([route, byUser]) =>
    Object.entries(byUser).map(
      ([user, status]) =>
        [route as keyof typeof routes, user as UserName, status] as const,
    ),
  );

  it.each(cells)("%s as %s: %i", async (route, user, status) => {
    const result = await routes[route](user);
    expect(result.status).toBe(status);
  });
});

describe("listing", () => {
  it("returns only the student's own consultations", async () => {
    const mine = await makeConsultation("mia");
    const theirs = await makeConsultation("sam");
    const { body } = await call("mia", get(list.GET));
    const rows = body.consultations as { id: string; studentId: string }[];
    expect(rows.every((row) => row.studentId === USERS.mia.id)).toBe(true);
    expect(rows.map((row) => row.id)).toContain(mine);
    expect(rows.map((row) => row.id)).not.toContain(theirs);
  });

  it("keeps an admin's own list to their own bookings", async () => {
    const { body } = await call("admin", get(list.GET));
    const rows = body.consultations as { studentId: string }[];
    expect(rows.every((row) => row.studentId === USERS.admin.id)).toBe(true);
  });

  it("gives an admin every student's rows with emails, cancelled included", async () => {
    const cancelled = await makeConsultation("mia", "cancelled");
    const sams = await makeConsultation("sam");
    const { status, body } = await call("admin", get(admin.GET));
    expect(status).toBe(200);
    const rows = body.consultations as { id: string; studentEmail: string }[];
    const byId = new Map(rows.map((row) => [row.id, row]));
    expect(byId.get(cancelled)?.studentEmail).toBe(USERS.mia.email);
    expect(byId.get(sams)?.studentEmail).toBe(USERS.sam.email);
  });
});

describe("booking", () => {
  it("books as booked for the caller", async () => {
    const { status, body } = await call("sam", list.POST, { body: booking });
    expect(status).toBe(201);
    expect(body.consultation).toMatchObject({
      studentId: USERS.sam.id,
      status: "booked",
    });
  });

  it.each([
    ["another student's id", { studentId: USERS.mia.id }],
    ["a status", { status: "completed" }],
    ["an unknown field", { admin: true }],
  ])("rejects a body with %s", async (_name, extra) => {
    const { status, body } = await call("sam", list.POST, {
      body: { ...booking, ...extra },
    });
    expect(status).toBe(400);
    expect(body.error.code).toBe("bad_request");
  });

  it("rejects a past time with a field message", async () => {
    const { status, body } = await call("mia", list.POST, {
      body: { ...booking, scheduledAt: daysFromNow(-1) },
    });
    expect(status).toBe(400);
    expect(body.error.details.scheduledAt).toEqual([
      "Choose a time in the future",
    ]);
  });

  it("rejects missing fields, one message each", async () => {
    const { status, body } = await call("mia", list.POST, { body: {} });
    expect(status).toBe(400);
    expect(Object.keys(body.error.details).sort()).toEqual([
      "firstName",
      "lastName",
      "reason",
      "scheduledAt",
    ]);
  });
});

describe("another student's consultation", () => {
  // Sam and the admin get the same 404 as for a missing row, and nothing changes.
  it.each([
    ["sam", "reschedule"],
    ["sam", "cancel"],
    ["sam", "complete"],
    ["admin", "reschedule"],
    ["admin", "cancel"],
    ["admin", "complete"],
  ] as const)("%s cannot %s Mia's", async (user, action) => {
    const id = await makeConsultation("mia");
    const before = await readRow(id);
    const handler = { reschedule, cancel, complete }[action].POST;
    const body =
      action === "reschedule"
        ? { scheduledAt: daysFromNow(9) }
        : action === "complete"
          ? { completed: true }
          : undefined;
    const result = await call(user, handler, { id, body });
    expect(result.status).toBe(404);
    expect(await readRow(id)).toEqual(before);
  });

  it("answers 404 for an id that is not a uuid", async () => {
    const result = await call("mia", cancel.POST, { id: "not-a-uuid" });
    expect(result.status).toBe(404);
  });
});

describe("rules, as the owner", () => {
  const actions = {
    reschedule: {
      handler: reschedule.POST,
      body: () => ({ scheduledAt: daysFromNow(9) }),
    },
    cancel: { handler: cancel.POST, body: () => undefined },
    complete: { handler: complete.POST, body: () => ({ completed: true }) },
    incomplete: { handler: complete.POST, body: () => ({ completed: false }) },
  };

  // [from status, action, expected status code, status afterwards]
  const cases = [
    ["booked", "reschedule", 200, "booked"],
    ["booked", "cancel", 200, "cancelled"],
    ["booked", "complete", 200, "completed"],
    ["booked", "incomplete", 200, "booked"],
    ["completed", "reschedule", 409, "completed"],
    ["completed", "cancel", 409, "completed"],
    ["completed", "complete", 200, "completed"],
    ["completed", "incomplete", 200, "booked"],
    ["cancelled", "reschedule", 409, "cancelled"],
    ["cancelled", "cancel", 409, "cancelled"],
    ["cancelled", "complete", 409, "cancelled"],
    ["cancelled", "incomplete", 409, "cancelled"],
  ] as const;

  it.each(cases)(
    "%s, %s: %i, then %s",
    async (from, action, expected, after) => {
      const id = await makeConsultation("mia", from);
      const { handler, body } = actions[action];
      const result = await call("mia", handler, { id, body: body() });
      expect(result.status).toBe(expected);
      if (expected === 409) expect(result.body.error.code).toBe("conflict");
      expect((await readRow(id)).status).toBe(after);
    },
  );

  it("rejects rescheduling into the past", async () => {
    const id = await makeConsultation("mia");
    const result = await call("mia", reschedule.POST, {
      id,
      body: { scheduledAt: daysFromNow(-1) },
    });
    expect(result.status).toBe(400);
  });

  it("rejects a body on cancel", async () => {
    const id = await makeConsultation("mia");
    const result = await call("mia", cancel.POST, {
      id,
      body: { status: "booked" },
    });
    expect(result.status).toBe(400);
    expect((await readRow(id)).status).toBe("booked");
  });
});
