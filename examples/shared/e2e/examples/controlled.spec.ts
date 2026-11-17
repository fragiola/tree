import { expect, test } from "@playwright/test";
import { item, openExample, row, tree } from "../helpers";

// controlled: the app's state is printed as JSON (test ids `expanded-state`, `selected-state`).
// An item's accessible name is its label.

test("the buttons outside the tree drive its expansion and selection", async ({
    page,
}) => {
    const stage = await openExample(page, "controlled");
    const files = tree(page, "Project files");
    const expanded = stage.getByTestId("expanded-state");
    const selected = stage.getByTestId("selected-state");
    await expect(expanded).toHaveText('["src"]');

    await stage.getByRole("button", { name: "Expand all" }).click();
    await expect(item(files, "components")).toHaveAttribute(
        "aria-expanded",
        "true",
    );
    await expect(item(files, "favicon.svg")).toBeVisible();

    await stage.getByRole("button", { name: "Collapse all" }).click();
    await expect(expanded).toHaveText("[]");
    await expect(item(files, "app.tsx")).toHaveCount(0);

    await stage.getByRole("button", { name: "Select README.md" }).click();
    await expect(item(files, "README.md")).toHaveAttribute(
        "aria-selected",
        "true",
    );
    await expect(selected).toHaveText('["readme"]');
    await stage.getByRole("button", { name: "Clear selection" }).click();
    await expect(selected).toHaveText("[]");
    await expect(item(files, "README.md")).toHaveAttribute(
        "aria-selected",
        "false",
    );
});

test("the tree reports its changes to the app's state", async ({ page }) => {
    const stage = await openExample(page, "controlled");
    const files = tree(page, "Project files");
    await row(item(files, "public"))
        .locator('[data-tree-part="toggle"]')
        .click();
    await expect(stage.getByTestId("expanded-state")).toHaveText(
        '["src","public"]',
    );
    await row(item(files, "package.json")).click();
    await expect(stage.getByTestId("selected-state")).toHaveText('["package"]');
});

test("the app can refuse a change: src stays open", async ({ page }) => {
    const stage = await openExample(page, "controlled");
    const files = tree(page, "Project files");
    await stage.getByRole("switch", { name: "Keep src open" }).click();
    const src = item(files, "src");
    await row(src).locator('[data-tree-part="toggle"]').click();
    await expect(src).toHaveAttribute("aria-expanded", "true");
    await src.focus();
    await page.keyboard.press("ArrowLeft");
    await expect(src).toHaveAttribute("aria-expanded", "true");
    await expect(stage.getByTestId("expanded-state")).toHaveText('["src"]');
});
