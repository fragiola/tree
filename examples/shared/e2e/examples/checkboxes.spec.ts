import { expect, test } from "@playwright/test";
import { item, openExample, row, tree } from "../helpers";

// checkboxes: an item's accessible name is its label; its check is its aria-checked. The check
// control is the app's own (a button hidden from assistive technology), reached by its test id.

test("a group is mixed, and checking its last permission checks it", async ({
    page,
}) => {
    const stage = await openExample(page, "checkboxes");
    const perms = tree(page, "Permissions");
    const content = item(perms, "Content");
    const scopes = stage.getByTestId("scopes");
    await expect(content).toHaveAttribute("aria-checked", "mixed");
    await expect(row(content).getByTestId("check")).toHaveAttribute(
        "data-indeterminate",
        "",
    );
    await expect(scopes).toContainText("content:read");
    await expect(scopes).not.toContainText("content:publish");

    await row(item(perms, "Publish pages")).getByTestId("check").click();
    await expect(item(perms, "Publish pages")).toHaveAttribute(
        "aria-checked",
        "true",
    );
    await expect(content).toHaveAttribute("aria-checked", "true");
    await expect(scopes).toContainText("content:publish");
});

test("checking a group checks every permission inside it", async ({ page }) => {
    const stage = await openExample(page, "checkboxes");
    const perms = tree(page, "Permissions");
    await row(item(perms, "Members")).getByTestId("check").click();
    await expect(item(perms, "Invite members")).toHaveAttribute(
        "aria-checked",
        "true",
    );
    await expect(item(perms, "Remove members")).toHaveAttribute(
        "aria-checked",
        "true",
    );
    await expect(stage.getByTestId("scopes")).toContainText("members:remove");
});

test("Space toggles the focused item's check", async ({ page }) => {
    const stage = await openExample(page, "checkboxes");
    const perms = tree(page, "Permissions");
    const invoices = item(perms, "See invoices");
    await invoices.focus();
    await page.keyboard.press(" ");
    await expect(invoices).toHaveAttribute("aria-checked", "true");
    await expect(item(perms, "Billing")).toHaveAttribute(
        "aria-checked",
        "mixed",
    );
    await page.keyboard.press(" ");
    await expect(invoices).toHaveAttribute("aria-checked", "false");
    await expect(stage.getByTestId("scopes")).not.toContainText("billing:read");
});
