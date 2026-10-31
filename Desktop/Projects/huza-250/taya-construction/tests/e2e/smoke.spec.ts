// Smoke flows (Delivery §5): 1) public equipment request (new client) →
// visible in admin; 2) invite → accept → login → an Admin cannot see the
// Super Admin; 3) new applicant applies, then applies again elsewhere with
// the phone only.

import { readFileSync } from "node:fs";
import { expect, test, type Page } from "@playwright/test";
import { E2E } from "../../playwright.config";

async function login(page: Page, email: string, password: string) {
  await page.goto("/login");
  await page.getByLabel("Email").fill(email);
  await page.getByLabel("Password").fill(password);
  await page.getByTestId("login-submit").click();
  await page.waitForURL("**/admin");
}

test("1. public equipment request from a new client appears in the admin list", async ({ page }) => {
  await page.goto("/equipment/demo-cat-320-excavator");
  await page.getByTestId("detail-request").click();
  await page.getByLabel("Site location").fill("Kicukiro, Kigali");
  await page.getByLabel("What do you need?").fill("Foundation works, 5 days with operator.");
  await page.getByRole("button", { name: /Next: your contact/ }).click();
  await page.getByLabel("Phone", { exact: true }).fill("0788 450 450");
  await page.getByLabel("Your name").fill("E2E New Client");
  await page.getByRole("checkbox").check();
  await page.getByTestId("request-submit").click();
  const code = (await page.getByTestId("request-code").textContent())!.trim();
  expect(code).toMatch(/^EQ-\d{4}$/);

  await login(page, E2E.superAdmin.email, E2E.superAdmin.password);
  await page.goto("/admin/equipment-requests");
  await expect(page.getByRole("link", { name: code })).toBeVisible();
  await page.getByRole("link", { name: code }).click();
  await expect(page.getByText("E2E New Client")).toBeVisible();
});

test("2. invite → accept → login: an Admin cannot see the Super Admin", async ({ page, browser }) => {
  await login(page, E2E.superAdmin.email, E2E.superAdmin.password);
  await page.goto("/admin/users");
  await page.getByTestId("invite-open").click();
  await page.locator('input[name="name"]').fill("E2E Admin");
  await page.locator('input[name="email"]').fill("e2e-admin@example.test");
  await page.locator('select[name="role"]').selectOption("ADMIN");
  await page.getByTestId("invite-save").click();
  await expect(page.getByText("e2e-admin@example.test")).toBeVisible();

  const mails = readFileSync(E2E.outbox, "utf8").trim().split("\n").map((l) => JSON.parse(l) as { to: string; text: string });
  const invite = mails.reverse().find((m) => m.to === "e2e-admin@example.test")!;
  const link = invite.text.match(/https?:\/\/\S+\/invite\/\S+/)![0];

  const other = await browser.newContext();
  const admin = await other.newPage();
  await admin.goto(link);
  await admin.getByLabel("New password").fill("e2e-admin-password");
  await admin.getByLabel("Repeat the password").fill("e2e-admin-password");
  await admin.getByTestId("set-password-submit").click();
  await admin.waitForURL("**/admin");
  await admin.goto("/admin/users");
  await expect(admin.getByText("e2e-admin@example.test")).toBeVisible();
  await expect(admin.getByText(E2E.superAdmin.email)).toHaveCount(0);
  // The invite link works once.
  const third = await (await browser.newContext()).newPage();
  await third.goto(link);
  await third.getByLabel("New password").fill("another-password-1");
  await third.getByLabel("Repeat the password").fill("another-password-1");
  await third.getByTestId("set-password-submit").click();
  await expect(third.getByText(/Invalid or expired/i)).toBeVisible();
  await other.close();
});

test("3. a new applicant applies, then applies to another job with the phone only", async ({ page }) => {
  await page.goto("/jobs");
  await page.getByRole("link", { name: "Demo Steel fixers" }).first().click();
  await page.getByTestId("apply-open").click();
  await page.getByLabel("Phone").fill("0788 321 321");
  await page.getByLabel("Full name").fill("E2E Applicant");
  await page.getByLabel("Date of birth").fill("1994-03-02");
  await page.getByLabel("Trade").fill("Steel fixer");
  await page.getByLabel("Experience").fill("6 years on residential sites.");
  await page.getByRole("checkbox").check();
  await page.getByTestId("apply-submit").click();
  await expect(page.getByTestId("apply-success")).toBeVisible();

  await page.goto("/jobs");
  await page.getByRole("link", { name: "E2E Second Job" }).first().click();
  await page.getByTestId("apply-open").click();
  await page.getByRole("radio", { name: "Yes" }).click();
  await page.getByLabel("Phone").fill("0788321321");
  await expect(page.getByText(/Welcome back/)).toBeVisible();
  await page.getByTestId("apply-submit").click();
  await expect(page.getByTestId("apply-success")).toBeVisible();
});

test("4. two-click rule: from Home, a request form for each target takes at most 2 clicks", async ({ page }) => {
  const nav = () => page.getByRole("navigation", { name: "Divisions" });
  const targets: { division: string; card?: RegExp; inline?: boolean }[] = [
    { division: "Equipment", card: /Demo CAT 320 Excavator/ },
    { division: "Materials", card: /Demo Floor Tiles/ },
    { division: "Inspection", card: /^Structural Inspections$/ },
    { division: "Waste", card: /^Waste Collection$/ },
    { division: "Workforce", inline: true },
    { division: "Paint Rwanda", card: /^Professional Painting$/ },
  ];
  for (const t of targets) {
    await page.goto("/");
    await nav().getByRole("link", { name: t.division }).click(); // click 1
    if (t.inline) {
      await expect(page.getByRole("button", { name: "Request workers" }).last()).toBeVisible();
      continue;
    }
    const card = page.locator("article").filter({ has: page.getByRole("link", { name: t.card! }) }).first();
    await card.getByRole("button", { name: "Request" }).click(); // click 2
    await expect(page.getByRole("dialog")).toBeVisible();
    await expect(page.getByRole("dialog").getByText("1. What you need")).toBeVisible();
  }
});
