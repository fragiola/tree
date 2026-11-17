import { expect, test } from "@playwright/test";
import { item, itemAt, openExample, row, tree } from "../helpers";

// async-loading: the fake server answers after ~500 ms, so every check waits (auto-retrying
// assertions). A row with a load error also holds its Retry button, so that item is reached by
// its path (/1, Documents); the others by their name (their label).

test("a folder loads its children the first time it opens", async ({
    page,
}) => {
    await openExample(page, "async-loading");
    const drive = tree(page, "Cloud drive");
    const photos = item(drive, "Photos");
    await row(photos).click();
    await expect(photos).toHaveAttribute("aria-expanded", "true");
    await expect(photos).toHaveAttribute("data-loading", "");
    await expect(photos).toHaveAttribute("aria-busy", "true");
    await expect(item(drive, "cover.jpg")).toBeVisible();
    await expect(photos).not.toHaveAttribute("data-loading");
    // a loaded folder can hold more folders to load
    await row(item(drive, "2024")).click();
    await expect(item(drive, "beach.jpg")).toBeVisible();
});

test("a failed load is announced, and Retry loads it again", async ({
    page,
}) => {
    const stage = await openExample(page, "async-loading");
    const drive = tree(page, "Cloud drive");
    const documents = itemAt(drive, "/1");
    await row(documents).click();
    await expect(documents).toHaveAttribute("data-load-error", "");
    await expect(stage.getByRole("status")).toHaveText(
        /Could not load Documents/,
    );
    await stage
        .getByRole("button", { name: "Retry loading Documents" })
        .click();
    await expect(item(drive, "cv.pdf")).toBeVisible();
    await expect(documents).not.toHaveAttribute("data-load-error");
});

test("Retry works from the keyboard", async ({ page }) => {
    const stage = await openExample(page, "async-loading");
    const drive = tree(page, "Cloud drive");
    const documents = itemAt(drive, "/1");
    await documents.focus();
    await page.keyboard.press("ArrowRight");
    const retry = stage.getByRole("button", {
        name: "Retry loading Documents",
    });
    await expect(retry).toBeVisible();
    await retry.focus();
    await page.keyboard.press("Enter");
    await expect(item(drive, "taxes")).toBeVisible();
});
