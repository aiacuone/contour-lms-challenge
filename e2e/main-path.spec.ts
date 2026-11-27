import { expect, test } from "@playwright/test";

import {
  cleanUp,
  expectNoA11yViolations,
  localDateTime,
  logIn,
} from "./support";

// The main path through the app in one browser test: a student books,
// reschedules, completes and cancels, then the admin sees it in the list.
// Each screen is checked for accessibility on the way.

const REASON = `test: e2e ${Date.now()}`;

test.afterAll(cleanUp);

test("a student manages a consultation and the admin sees it", async ({
  page: student,
  browser,
}) => {
  await test.step("log in", async () => {
    await student.goto("/auth/login");
    await expectNoA11yViolations(student);
    await logIn(student, "student@example.com");
    await expect(student.getByRole("table")).toBeVisible();
    await expectNoA11yViolations(student);
  });

  const row = student.getByRole("row").filter({ hasText: REASON });

  await test.step("book", async () => {
    await student.getByRole("button", { name: "Book consultation" }).click();
    const dialog = student.getByRole("dialog");
    await expect(dialog).toBeVisible();

    await dialog.getByRole("button", { name: "Book" }).click();
    await expect(dialog.getByText("Required")).toHaveCount(4);
    await expectNoA11yViolations(student);

    await dialog.getByLabel("First name").fill("Mia");
    await dialog.getByLabel("Last name").fill("Nguyen");
    await dialog.getByLabel("Reason for consultation").fill(REASON);
    await dialog.getByLabel("Date and time").fill(localDateTime(5));
    await dialog.getByRole("button", { name: "Book" }).click();

    await expect(dialog).toBeHidden();
    await expect(row.getByText("Booked")).toBeVisible();
  });

  await test.step("reschedule", async () => {
    const before = await row.locator("time").getAttribute("datetime");
    await row.getByRole("button", { name: "Reschedule" }).click();
    const dialog = student.getByRole("dialog");
    await expectNoA11yViolations(student);
    await dialog.getByLabel("New date and time").fill(localDateTime(8));
    await dialog.getByRole("button", { name: "Reschedule" }).click();
    await expect(dialog).toBeHidden();
    await expect(row.locator("time")).not.toHaveAttribute("datetime", before!);
  });

  await test.step("complete, then incomplete", async () => {
    await row.getByRole("button", { name: "Mark complete" }).click();
    await expect(row.getByText("Completed")).toBeVisible();
    await row.getByRole("button", { name: "Mark incomplete" }).click();
    await expect(row.getByText("Booked")).toBeVisible();
  });

  await test.step("cancel", async () => {
    await row.getByRole("button", { name: "Cancel" }).click();
    const confirm = student.getByRole("alertdialog");
    await expectNoA11yViolations(student);
    await confirm.getByRole("button", { name: "Cancel consultation" }).click();
    await expect(confirm).toBeHidden();
    await expect(row.getByText("Cancelled")).toBeVisible();
    await expect(row.getByRole("button")).toHaveCount(0);
  });

  await test.step("a student cannot open the admin list", async () => {
    await student.goto("/admin/consultations");
    await expect(
      student.getByRole("heading", {
        name: "You don't have access to this page",
      }),
    ).toBeVisible();
    await expectNoA11yViolations(student);
  });

  await test.step("the admin sees it, cancelled, with the email", async () => {
    // A separate context, so the admin has their own session.
    const context = await browser.newContext(test.info().project.use);
    const admin = await context.newPage();
    await logIn(admin, "admin@example.com");
    await admin.getByRole("link", { name: "All consultations" }).click();
    const adminRow = admin.getByRole("row").filter({ hasText: REASON });
    await expect(adminRow.getByText("student@example.com")).toBeVisible();
    await expect(adminRow.getByText("Cancelled")).toBeVisible();
    await expect(admin.getByRole("table").getByRole("button")).toHaveCount(0);
    await expectNoA11yViolations(admin);
  });
});
