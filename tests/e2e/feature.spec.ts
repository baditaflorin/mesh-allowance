import { expect, test } from "@playwright/test";
import { openTwoPeers } from "@baditaflorin/mesh-common/testing";
import { readFileSync } from "node:fs";

const pkg = JSON.parse(readFileSync(new URL("../../package.json", import.meta.url), "utf8")) as {
  name: string;
};
const storagePrefix = pkg.name;

test("kid + chore + verify flow: balance updates on both peers", async ({ browser, baseURL }) => {
  const { a, b, cleanup } = await openTwoPeers(browser, baseURL ?? "", { storagePrefix });
  try {
    // A adds kid + chore
    await a.getByPlaceholder("add a kid by name").fill("emma");
    await a.getByRole("button", { name: "+ add kid", exact: true }).click();

    await expect(b.locator(".all-kid-name")).toContainText("emma");

    await a.getByPlaceholder("chore (e.g. take out trash)").fill("dishes");
    await a.getByLabel("value").fill("5");
    await a.getByRole("button", { name: "+ add chore", exact: true }).click();

    await expect(b.locator(".all-chore-label")).toContainText(["dishes"]);

    // B marks done
    await b.getByRole("button", { name: "mark done", exact: true }).click();

    await expect(a.locator(".all-pending")).toBeVisible();

    // A verifies → balance + $5 on B
    await a.getByRole("button", { name: "✓ verify", exact: true }).click();

    await expect(b.locator(".all-balance-amt")).toContainText("$5.00");
    await expect(a.locator(".all-balance-amt")).toContainText("$5.00");
  } finally {
    await cleanup();
  }
});
