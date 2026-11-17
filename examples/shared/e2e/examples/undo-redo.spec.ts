import { expect, test } from "@playwright/test";
import { item, openExample, row, tree } from "../helpers";

// undo-redo: the history is the example's (app code over `tree-json` and `tree.load`). An
// item's accessible name is its label.

test("Delete, then Undo and Redo with the buttons", async ({ page }) => {
    const stage = await openExample(page, "undo-redo");
    const files = tree(page, "Project files");
    const undo = stage.getByRole("button", { name: "Undo" });
    const redo = stage.getByRole("button", { name: "Redo" });
    await expect(undo).toBeDisabled();

    await row(item(files, "main.tsx")).click();
    await stage.getByRole("button", { name: "Delete" }).click();
    await expect(item(files, "main.tsx")).toHaveCount(0);
    await expect(stage.getByTestId("history")).toContainText("Delete");

    await undo.click();
    await expect(item(files, "main.tsx")).toBeVisible();
    await expect(redo).toBeEnabled();
    await redo.click();
    await expect(item(files, "main.tsx")).toHaveCount(0);
});

test("a rename is a step: Ctrl+Z undoes it, Ctrl+Shift+Z redoes it", async ({
    page,
}) => {
    const stage = await openExample(page, "undo-redo");
    const files = tree(page, "Project files");
    await item(files, "app.tsx").focus();
    await page.keyboard.press("F2");
    const input = stage.getByRole("textbox", { name: "Rename app.tsx" });
    await input.fill("shell.tsx");
    await input.press("Enter");
    await expect(item(files, "shell.tsx")).toBeFocused();

    await page.keyboard.press("ControlOrMeta+z");
    await expect(item(files, "app.tsx")).toBeVisible();
    await expect(item(files, "shell.tsx")).toHaveCount(0);
    await item(files, "app.tsx").focus();
    await page.keyboard.press("ControlOrMeta+Shift+z");
    await expect(item(files, "shell.tsx")).toBeVisible();
});

test("the Delete key removes the selection, as one step", async ({ page }) => {
    const stage = await openExample(page, "undo-redo");
    const files = tree(page, "Project files");
    await row(item(files, "README.md")).click();
    await page.keyboard.press("Delete");
    await expect(item(files, "README.md")).toHaveCount(0);
    await stage.getByRole("button", { name: "Undo" }).click();
    await expect(item(files, "README.md")).toBeVisible();
});
