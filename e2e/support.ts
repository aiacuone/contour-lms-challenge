import AxeBuilder from "@axe-core/playwright";
import { expect, type Page } from "@playwright/test";

import { cleanUp } from "../tests/support";

// Shared steps for the browser tests. Rows the tests book have a reason
// starting with "test:", and cleanUp() removes only those.

export { cleanUp };

export async function logIn(page: Page, email: string) {
  await page.goto("/auth/login");
  await page.getByLabel("Email").fill(email);
  await page.getByLabel("Password").fill("password123");
  await page.getByRole("button", { name: "Log in" }).click();
  await page.waitForURL("**/dashboard");
}

// Fails with the list of WCAG A and AA violations on the page as it is now.
// Waits for animations to end first: a dialog that is still fading in is
// partly transparent, and axe would report its text as low contrast.
export async function expectNoA11yViolations(page: Page) {
  await page.waitForFunction(() =>
    document.getAnimations().every((a) => a.playState !== "running"),
  );
  const results = await new AxeBuilder({ page })
    .withTags(["wcag2a", "wcag2aa", "wcag21a", "wcag21aa"])
    .analyze();
  const summary = results.violations.map(
    (v) => `${v.id}: ${v.help} (${v.nodes.map((n) => n.target).join(", ")})`,
  );
  expect(summary).toEqual([]);
}

// A datetime-local value for the given number of days from now, at 10:00 in
// the browser's time zone (the config sets Melbourne).
export function localDateTime(days: number): string {
  const parts = Object.fromEntries(
    new Intl.DateTimeFormat("en-CA", {
      timeZone: "Australia/Melbourne",
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
    })
      .formatToParts(new Date(Date.now() + days * 86_400_000))
      .map((p) => [p.type, p.value]),
  );
  return `${parts.year}-${parts.month}-${parts.day}T10:00`;
}
