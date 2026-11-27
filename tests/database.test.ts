import { afterAll, beforeAll, describe, expect, it } from "vitest";

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

// The database layer on its own: row-level security, column grants and the
// rules trigger, queried directly as each seeded user. These hold even if an
// API route forgot a check. See docs/adr/0003-access-control.md and
// docs/adr/0008-cancel-and-reschedule-rules.md.

let as: Record<UserName, DbClient>;
let miaRow: string;
let samRow: string;

beforeAll(async () => {
  as = await clientsForAll();
  miaRow = await makeConsultation("mia");
  samRow = await makeConsultation("sam");
});

afterAll(cleanUp);

const PRIVILEGE = "42501"; // permission denied: a missing grant
const RULE = "P0001"; // raised by the rules trigger

const booking = {
  first_name: "Mia",
  last_name: "Test",
  reason: TEST_REASON,
  scheduled_at: daysFromNow(3),
};

describe("reading consultations", () => {
  it("refuses a logged-out visitor", async () => {
    const { error } = await as.anon.from("consultations").select("id");
    expect(error?.code).toBe(PRIVILEGE);
  });

  it("shows a student only their own rows", async () => {
    const { data, error } = await as.mia
      .from("consultations")
      .select("id, student_id");
    expect(error).toBeNull();
    expect(data!.length).toBeGreaterThan(0);
    expect(data!.every((row) => row.student_id === USERS.mia.id)).toBe(true);
    expect(data!.map((row) => row.id)).toContain(miaRow);
  });

  it.each([
    ["sam", "mia", () => miaRow],
    ["mia", "sam", () => samRow],
  ] as const)(
    "hides %s from %s's row, even by id",
    async (reader, _owner, id) => {
      const { data, error } = await as[reader]
        .from("consultations")
        .select("id")
        .eq("id", id());
      expect(error).toBeNull();
      expect(data).toEqual([]);
    },
  );

  it("shows an admin every student's rows", async () => {
    const { data, error } = await as.admin
      .from("consultations")
      .select("id")
      .in("id", [miaRow, samRow]);
    expect(error).toBeNull();
    expect(data).toHaveLength(2);
  });
});

describe("booking", () => {
  it("books for the logged-in student, as booked", async () => {
    const { data, error } = await as.mia
      .from("consultations")
      .insert(booking)
      .select("student_id, status")
      .single();
    expect(error).toBeNull();
    expect(data).toEqual({ student_id: USERS.mia.id, status: "booked" });
  });

  it("refuses a logged-out visitor", async () => {
    const { error } = await as.anon.from("consultations").insert(booking);
    expect(error?.code).toBe(PRIVILEGE);
  });

  it.each([
    ["for another student", { student_id: USERS.sam.id }],
    ["with a status other than booked", { status: "completed" as const }],
    ["with its own id", { id: crypto.randomUUID() }],
  ])("refuses booking %s", async (_name, extra) => {
    const { error } = await as.mia
      .from("consultations")
      .insert({ ...booking, ...extra });
    expect(error?.code).toBe(PRIVILEGE);
  });

  it("refuses a time in the past", async () => {
    const { error } = await as.mia
      .from("consultations")
      .insert({ ...booking, scheduled_at: daysFromNow(-1) });
    expect(error?.code).toBe(RULE);
    expect(error?.message).toBe("Consultation must be in the future.");
  });
});

describe("changing another student's consultation", () => {
  // RLS hides the row, so the update matches nothing and changes nothing.
  it.each([
    ["sam", "reschedule", { scheduled_at: daysFromNow(9) }],
    ["sam", "cancel", { status: "cancelled" as const }],
    ["sam", "complete", { status: "completed" as const }],
    ["admin", "reschedule", { scheduled_at: daysFromNow(9) }],
    ["admin", "cancel", { status: "cancelled" as const }],
  ] as const)("%s cannot %s Mia's row", async (user, _action, change) => {
    const before = await readRow(miaRow);
    const { data, error } = await as[user]
      .from("consultations")
      .update(change)
      .eq("id", miaRow)
      .select("id");
    expect(error).toBeNull();
    expect(data).toEqual([]);
    expect(await readRow(miaRow)).toEqual(before);
  });

  it("a student cannot delete anyone's row, even their own", async () => {
    const { error } = await as.mia
      .from("consultations")
      .delete()
      .eq("id", miaRow);
    expect(error?.code).toBe(PRIVILEGE);
    expect(await readRow(miaRow)).toBeTruthy();
  });
});

describe("changing columns a student does not own", () => {
  it.each([
    ["move it to another student", { student_id: USERS.sam.id }],
    ["change the reason", { reason: "test: edited" }],
    ["change the name", { first_name: "Someone" }],
    ["change created_at", { created_at: daysFromNow(-30) }],
  ])("refuses an update to %s", async (_name, change) => {
    const { error } = await as.mia
      .from("consultations")
      .update(change)
      .eq("id", miaRow);
    expect(error?.code).toBe(PRIVILEGE);
  });
});

describe("rules trigger, as the owner", () => {
  type Change =
    { scheduled_at: string } | { status: "booked" | "completed" | "cancelled" };
  const reschedule = (): Change => ({ scheduled_at: daysFromNow(10) });
  const toStatus = (status: "booked" | "completed" | "cancelled") => () =>
    ({ status }) as Change;

  // [from status, action, change, error message or null when allowed]
  const cases = [
    ["booked", "reschedule", reschedule, null],
    ["booked", "cancel", toStatus("cancelled"), null],
    ["booked", "complete", toStatus("completed"), null],
    ["completed", "mark incomplete", toStatus("booked"), null],
    [
      "completed",
      "reschedule",
      reschedule,
      "Only booked consultations can be rescheduled.",
    ],
    [
      "completed",
      "cancel",
      toStatus("cancelled"),
      "Only booked consultations can be cancelled.",
    ],
    [
      "cancelled",
      "reschedule",
      reschedule,
      "Cancelled consultations can't be changed.",
    ],
    [
      "cancelled",
      "reopen",
      toStatus("booked"),
      "Cancelled consultations can't be changed.",
    ],
    [
      "cancelled",
      "complete",
      toStatus("completed"),
      "Cancelled consultations can't be changed.",
    ],
  ] as const;

  it.each(cases)("%s: %s", async (from, _action, change, expectedError) => {
    const id = await makeConsultation("mia", from);
    const { data, error } = await as.mia
      .from("consultations")
      .update(change())
      .eq("id", id)
      .select("id");
    if (expectedError === null) {
      expect(error).toBeNull();
      expect(data).toHaveLength(1);
    } else {
      expect(error?.code).toBe(RULE);
      expect(error?.message).toBe(expectedError);
      expect((await readRow(id)).status).toBe(from);
    }
  });

  it("refuses rescheduling into the past", async () => {
    const id = await makeConsultation("mia");
    const { error } = await as.mia
      .from("consultations")
      .update({ scheduled_at: daysFromNow(-1) })
      .eq("id", id);
    expect(error?.code).toBe(RULE);
    expect(error?.message).toBe("Consultation must be in the future.");
  });
});

describe("roles", () => {
  it("a student cannot make themselves an admin", async () => {
    const { error } = await as.mia
      .from("user_roles")
      .insert({ user_id: USERS.mia.id, role: "admin" });
    expect(error?.code).toBe(PRIVILEGE);
    const { data } = await as.mia.rpc("is_admin");
    expect(data).toBe(false);
  });

  it.each([
    ["mia", false],
    ["sam", false],
    ["admin", true],
  ] as const)("is_admin() is %s for %s", async (user, expected) => {
    const { data, error } = await as[user].rpc("is_admin");
    expect(error).toBeNull();
    expect(data).toBe(expected);
  });
});

describe("admin_consultations()", () => {
  it("refuses a logged-out visitor", async () => {
    const { error } = await as.anon.rpc("admin_consultations");
    expect(error?.code).toBe(PRIVILEGE);
  });

  it.each(["mia", "sam"] as const)(
    "returns no rows to a student (%s)",
    async (user) => {
      const { data, error } = await as[user].rpc("admin_consultations");
      expect(error).toBeNull();
      expect(data).toEqual([]);
    },
  );

  it("returns every row with the student's email to an admin", async () => {
    const { data, error } = await as.admin.rpc("admin_consultations");
    expect(error).toBeNull();
    const byId = new Map(data!.map((row) => [row.id, row]));
    expect(byId.get(miaRow)?.student_email).toBe(USERS.mia.email);
    expect(byId.get(samRow)?.student_email).toBe(USERS.sam.email);
  });
});
