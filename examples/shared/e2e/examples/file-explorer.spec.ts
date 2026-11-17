import { expect, test } from "@playwright/test";
import { item, itemAt, openExample, row, tree } from "../helpers";

// file-explorer: an item's accessible name is its label; a file's size is not part of it (the row
// hides it from assistive technology and the item references it as its description).

test("a click on a folder's row opens and closes it (expandOnClick)", async ({
    page,
}) => {
    await openExample(page, "file-explorer");
    const files = tree(page, "Project files");
    const components = item(files, "components");
    await expect(components).toHaveAttribute("aria-expanded", "false");
    await row(components).click();
    await expect(components).toHaveAttribute("aria-expanded", "true");
    await expect(item(files, "tree-view.tsx")).toBeVisible();
    await row(components).click();
    await expect(components).toHaveAttribute("aria-expanded", "false");
    await expect(item(files, "tree-view.tsx")).toHaveCount(0);
});

test("a file shows its size, as its description", async ({ page }) => {
    await openExample(page, "file-explorer");
    const files = tree(page, "Project files");
    const readme = item(files, "README.md");
    await expect(readme).toHaveAccessibleDescription("3.3 KB");
    await expect(row(readme)).toContainText("3.3 KB");
    // a child row sits deeper than its parent's
    await expect(itemAt(files, "/0/0")).toHaveAttribute("aria-level", "2");
});

test("a file is selected on a click, and stays a leaf", async ({ page }) => {
    await openExample(page, "file-explorer");
    const files = tree(page, "Project files");
    const app = item(files, "app.tsx");
    await row(app).click();
    await expect(app).toHaveAttribute("aria-selected", "true");
    await expect(app).not.toHaveAttribute("aria-expanded");
});
