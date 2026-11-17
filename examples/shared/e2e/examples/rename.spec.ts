import { expect, test } from "@playwright/test";
import { item, openExample, row, tree } from "../helpers";

// rename: an item's accessible name is its label (while renaming, the input is named
// "Rename <label>").

test("F2 renames; a middleware refuses a duplicate or a slash", async ({
    page,
}) => {
    const stage = await openExample(page, "rename");
    const files = tree(page, "Project files");
    await item(files, "app.tsx").focus();
    await page.keyboard.press("F2");
    const input = stage.getByRole("textbox", { name: "Rename app.tsx" });
    await expect(input).toBeFocused();
    await expect(item(files, "app.tsx")).toHaveAttribute("data-renaming", "");

    await input.fill("main.tsx");
    await input.press("Enter");
    await expect(input).toHaveAttribute("aria-invalid", "true");
    await expect(stage.getByRole("alert")).toHaveText(/already in this folder/);

    await input.fill("a/b.tsx");
    await input.press("Enter");
    await expect(stage.getByRole("alert")).toHaveText(/cannot contain/);

    await input.fill("  entry.tsx  ");
    await input.press("Enter");
    await expect(input).toHaveCount(0);
    await expect(stage.getByRole("alert")).toHaveText("");
    // the middleware trimmed the label; focus is back on the item
    await expect(item(files, "entry.tsx")).toBeFocused();
});

test("a double click renames, Escape cancels", async ({ page }) => {
    const stage = await openExample(page, "rename");
    const files = tree(page, "Project files");
    await row(item(files, "README.md")).dblclick();
    const input = stage.getByRole("textbox", { name: "Rename README.md" });
    await expect(input).toBeFocused();
    await input.fill("");
    await input.press("Enter");
    await expect(input).toHaveAttribute("aria-invalid", "true");
    await input.press("Escape");
    await expect(input).toHaveCount(0);
    await expect(item(files, "README.md")).toBeFocused();
});
