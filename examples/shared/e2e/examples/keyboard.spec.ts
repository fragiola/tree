import { expect, test } from "@playwright/test";
import { focusedPath, item, itemAt, openExample, tree } from "../helpers";

// keyboard: every key is the engine's; the live region (visible in this example) says each step
// of a keyboard drag. An item's accessible name is its label.

test("arrows, Home, End and type-ahead move the focus", async ({ page }) => {
    await openExample(page, "keyboard");
    const files = tree(page, "Project files");
    await itemAt(files, "/0").focus();
    await page.keyboard.press("ArrowDown");
    expect(await focusedPath(page)).toBe("/0/0");
    // components is collapsed: Right expands it, Right again enters it
    await page.keyboard.press("ArrowRight");
    await expect(item(files, "components")).toHaveAttribute(
        "aria-expanded",
        "true",
    );
    await page.keyboard.press("ArrowRight");
    await expect(item(files, "button.tsx")).toBeFocused();
    await page.keyboard.press("End");
    await expect(item(files, "README.md")).toBeFocused();
    await page.keyboard.press("Home");
    expect(await focusedPath(page)).toBe("/0");
    // type-ahead: "p" finds public, then package.json
    await page.keyboard.press("p");
    await expect(item(files, "public")).toBeFocused();
    await page.keyboard.press("p");
    await expect(item(files, "package.json")).toBeFocused();
});

test("Space and Shift+Down select, Ctrl+A selects all", async ({ page }) => {
    await openExample(page, "keyboard");
    const files = tree(page, "Project files");
    await item(files, "app.tsx").focus();
    await page.keyboard.press(" ");
    await page.keyboard.press("Shift+ArrowDown");
    await expect(item(files, "app.tsx")).toHaveAttribute(
        "aria-selected",
        "true",
    );
    await expect(item(files, "main.tsx")).toHaveAttribute(
        "aria-selected",
        "true",
    );
    await page.keyboard.press("ControlOrMeta+a");
    await expect(item(files, "README.md")).toHaveAttribute(
        "aria-selected",
        "true",
    );
});

test("a keyboard drag is announced at every step, and drops with Enter", async ({
    page,
}) => {
    const stage = await openExample(page, "keyboard");
    const files = tree(page, "Project files");
    const status = stage.getByRole("status");
    await item(files, "README.md").focus();
    await page.keyboard.press("Control+Shift+D");
    await expect(files).toHaveAttribute("data-keyboard-dragging", "");
    // the start and the first place are said together
    await expect(status).toHaveText(/^Picked up README\.md\. .* Drop .+\.$/);
    await page.keyboard.press("ArrowDown");
    await expect(status).toHaveText(/^Drop /);
    await page.keyboard.press("Escape");
    await expect(status).toHaveText("Cancelled. README.md stayed in place.");
    await expect(files).not.toHaveAttribute("data-keyboard-dragging");

    await item(files, "README.md").focus();
    await page.keyboard.press("Control+Shift+D");
    await page.keyboard.press("Enter");
    await expect(status).toHaveText(/^Moved README\.md /);
    await expect(files).not.toHaveAttribute("data-keyboard-dragging");
});

test("F2 opens the rename input", async ({ page }) => {
    const stage = await openExample(page, "keyboard");
    const files = tree(page, "Project files");
    await item(files, "main.tsx").focus();
    await page.keyboard.press("F2");
    await expect(
        stage.getByRole("textbox", { name: "Rename main.tsx" }),
    ).toBeFocused();
});
