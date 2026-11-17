import { expect, type Page, test } from "@playwright/test";
import { dragOver, item, row } from "./helpers";

// Scenarios are dev-only entries of the playground; the Inspector shows what a scenario's model
// does: every committed command, the tree's JSON and every [data-tree-part] element's state.

const inspector = (page: Page) =>
    page.getByRole("complementary", { name: "Inspector" });
const commandNames = (page: Page) =>
    inspector(page).getByTestId("command-name");

async function open(page: Page, scenario: string) {
    await page.goto(`/?scenario=${scenario}&inspect=1`);
    await expect(page.getByTestId("stage").getByRole("tree")).toBeVisible();
    await expect(inspector(page)).toBeVisible();
}

test("logs each command a button runs, and the model JSON follows", async ({
    page,
}) => {
    await open(page, "api/commands");
    await page.getByRole("button", { name: "Expand all" }).click();
    await expect(commandNames(page).first()).toHaveText("tree.expand-all");
    await page.getByRole("button", { name: "Rename readme" }).click();
    await expect(commandNames(page).first()).toHaveText("item.rename");
    // one listener: each command is logged once, also under StrictMode
    await expect(commandNames(page)).toHaveCount(2);
    await inspector(page).getByRole("button", { name: "Model" }).click();
    await expect(inspector(page).getByTestId("model-json")).toContainText(
        '"label": "readme.md*"',
    );
});

test("shows the drag state live, and logs the drop", async ({ page }) => {
    await open(page, "drag/locked-folders");
    await inspector(page).getByRole("button", { name: "State" }).click();
    const rootState = inspector(page).locator('[data-state-path="root"]');
    await expect(rootState).not.toContainText("data-dragging");
    const drop = await dragOver(
        page,
        row(item(page, "readme.md")),
        row(item(page, "a.txt")),
        0.15,
    );
    await expect(rootState).toContainText("data-dragging");
    await expect(
        inspector(page).locator('[data-state-path="item /0/0"]'),
    ).toContainText('data-drop-position="before"');
    await drop();
    await inspector(page).getByRole("button", { name: "Commands" }).click();
    await expect(commandNames(page)).toContainText(["item.move"]);
});

test("the stress scenario renders its 2,220 items", async ({ page }) => {
    await page.goto("/?scenario=tree/stress");
    await expect(page.getByRole("treeitem")).toHaveCount(2220);
});
