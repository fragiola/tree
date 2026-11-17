import { expect, test } from "@playwright/test";
import { item, itemAt, openExample, tree } from "../helpers";

// command-console: commands typed as JSON run through `model.dispatch`; the outcome is printed
// (test id `console-result`, `data-status` ok or error). An item's accessible name is its label.

test("a preset runs its command on the tree", async ({ page }) => {
    const stage = await openExample(page, "command-console");
    const files = tree(page, "Project files");
    await stage.getByRole("button", { name: "Expand all" }).click();
    await expect(item(files, "button.tsx")).toBeVisible();
    await expect(stage.getByTestId("console-result")).toHaveAttribute(
        "data-status",
        "ok",
    );

    await stage
        .getByRole("button", { name: "Move README.md into src" })
        .click();
    await expect(itemAt(files, "/0/0")).toHaveAccessibleName("README.md");
});

test("typed JSON is validated: a bad payload and bad JSON are errors", async ({
    page,
}) => {
    const stage = await openExample(page, "command-console");
    const files = tree(page, "Project files");
    const input = stage.getByRole("textbox", { name: "Command (JSON)" });
    const result = stage.getByTestId("console-result");
    const dispatch = stage.getByRole("button", { name: "Dispatch" });

    await input.fill(
        '{ "command": "item.select", "payload": { "itemId": "main" } }',
    );
    await dispatch.click();
    await expect(item(files, "main.tsx")).toHaveAttribute(
        "aria-selected",
        "true",
    );

    await input.fill('{ "command": "item.expand", "payload": {} }');
    await dispatch.click();
    await expect(result).toHaveAttribute("data-status", "error");
    await expect(result).toContainText("invalid_payload");

    await input.fill("{ nope");
    await input.press("ControlOrMeta+Enter");
    await expect(result).toContainText("Invalid JSON");
});

test("the app's middleware refuses a deletion from the console", async ({
    page,
}) => {
    const stage = await openExample(page, "command-console");
    const files = tree(page, "Project files");
    await stage.getByRole("button", { name: "Delete README.md" }).click();
    await expect(stage.getByTestId("console-result")).toContainText("vetoed");
    await expect(item(files, "README.md")).toBeVisible();
    // every command is listed from the model
    await stage.getByText(/^Every command/).click();
    await expect(stage.getByText("item.move", { exact: true })).toBeVisible();
});
