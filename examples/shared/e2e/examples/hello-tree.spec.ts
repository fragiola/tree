import { expect, test } from "@playwright/test";
import { focusedPath, item, itemAt, openExample, row, tree } from "../helpers";

// hello-tree: the smallest tree. An item's accessible name is its row's text (its label).

test("expands and collapses with the toggle and the arrows", async ({
    page,
}) => {
    await openExample(page, "hello-tree");
    const docs = tree(page, "Documents");
    await expect(item(docs, "Documents")).toHaveAttribute(
        "aria-expanded",
        "true",
    );
    await expect(item(docs, "Plan.md")).toBeVisible();

    const notes = item(docs, "Notes");
    await expect(notes).toHaveAttribute("aria-expanded", "false");
    await row(notes).locator('[data-tree-part="toggle"]').click();
    await expect(notes).toHaveAttribute("aria-expanded", "true");
    await expect(item(docs, "Ideas.md")).toBeVisible();

    await itemAt(docs, "/0").focus();
    await page.keyboard.press("ArrowDown");
    expect(await focusedPath(page)).toBe("/0/0");
    await page.keyboard.press("ArrowLeft");
    expect(await focusedPath(page)).toBe("/0");
    await page.keyboard.press("ArrowLeft");
    await expect(item(docs, "Documents")).toHaveAttribute(
        "aria-expanded",
        "false",
    );
    await expect(item(docs, "Plan.md")).toHaveCount(0);
});

test("a click focuses an item; the tree, with no feature, selects nothing", async ({
    page,
}) => {
    await openExample(page, "hello-tree");
    const docs = tree(page, "Documents");
    await row(item(docs, "Budget.csv")).click();
    await expect(item(docs, "Budget.csv")).toBeFocused();
    await expect(docs.locator("[aria-selected]")).toHaveCount(0);
    await expect(docs.locator("[data-selected]")).toHaveCount(0);
});
