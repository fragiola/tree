import { expect, test } from "@playwright/test";
import { item, openExample, reset, row, tree } from "../helpers";

// save-restore: the document is saved to the browser's localStorage after every change, and
// read back when the example loads. Each test has a fresh browser context (empty storage).

test("a change survives a reload, and Reset brings the default back", async ({
    page,
}) => {
    const stage = await openExample(page, "save-restore");
    const files = tree(page, "Project files");
    const status = stage.getByTestId("save-status");
    await expect(item(files, "src")).toHaveAttribute("aria-expanded", "true");

    await row(item(files, "src")).locator('[data-tree-part="toggle"]').click();
    await row(item(files, "README.md")).click();
    await stage.getByRole("button", { name: "Delete" }).click();
    await expect(item(files, "README.md")).toHaveCount(0);
    await expect(status).toHaveText(/^Saved at /);

    await reset(page);
    const again = tree(page, "Project files");
    await expect(page.getByTestId("save-status")).toHaveText(
        "Restored from this browser",
    );
    await expect(item(again, "src")).toHaveAttribute("aria-expanded", "false");
    await expect(item(again, "README.md")).toHaveCount(0);

    await page.getByRole("button", { name: "Reset" }).click();
    await expect(item(again, "src")).toHaveAttribute("aria-expanded", "true");
    await expect(item(again, "README.md")).toBeVisible();
});
