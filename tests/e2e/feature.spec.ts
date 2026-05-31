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

/**
 * Load-bearing cross-peer assertion for the two state transitions the original
 * test didn't cover: (1) a verified chore leaves the open list and lands in the
 * verified-history on the OPPOSITE peer, and (2) cashing out (the "money out"
 * half of an allowance tracker) zeroes the balance on BOTH peers. Both are core
 * money mutations that go through the Yjs doc; a regression that wrote either to
 * React state instead of `kids`/`chores` would pass the old test but fail here.
 */
test("verify moves chore to history on the other peer; cash out zeroes both balances", async ({
  browser,
  baseURL,
}) => {
  const { a, b, cleanup } = await openTwoPeers(browser, baseURL ?? "", { storagePrefix });
  try {
    // Setup: A adds a kid + a $7.50 chore; both propagate to B.
    await a.getByPlaceholder("add a kid by name").fill("noah");
    await a.getByRole("button", { name: "+ add kid", exact: true }).click();
    await expect(b.locator(".all-kid-name")).toContainText("noah");

    await a.getByPlaceholder("chore (e.g. take out trash)").fill("mow lawn");
    await a.getByLabel("value").fill("7.50");
    await a.getByRole("button", { name: "+ add chore", exact: true }).click();
    await expect(b.locator(".all-chore-label")).toContainText(["mow lawn"]);

    // B (the kid) marks it done; A (the parent) verifies it.
    await b.getByRole("button", { name: "mark done", exact: true }).click();
    await expect(a.locator(".all-pending")).toBeVisible();
    await a.getByRole("button", { name: "✓ verify", exact: true }).click();

    // Balance credited on both peers...
    await expect(a.locator(".all-balance-amt")).toContainText("$7.50");
    await expect(b.locator(".all-balance-amt")).toContainText("$7.50");

    // ...and on B the chore has LEFT the open lists (no pending/todo groups)
    // and now lives in the verified-history details — proving the `verified`
    // status itself crossed the mesh, not just the number.
    await expect(b.locator(".all-pending")).toHaveCount(0);
    await expect(b.locator(".all-todo")).toHaveCount(0);
    await expect(b.locator(".all-history summary")).toContainText("verified history (1)");

    // Cash out from peer A. cashOut() guards behind a confirm() dialog, so
    // accept it; the balance must then zero on the OPPOSITE peer B too.
    a.once("dialog", (d) => d.accept());
    await a.getByRole("button", { name: "cash out", exact: true }).click();

    await expect(b.locator(".all-balance-amt")).toContainText("$0.00");
    await expect(a.locator(".all-balance-amt")).toContainText("$0.00");
    // Cash-out button disables at zero balance on both peers.
    await expect(a.getByRole("button", { name: "cash out", exact: true })).toBeDisabled();
    await expect(b.getByRole("button", { name: "cash out", exact: true })).toBeDisabled();
  } finally {
    await cleanup();
  }
});
