import { expect, test } from "@playwright/test";
import { item, openExample, row, tree } from "../helpers";

// multi-select: an item's accessible name is the person's name (the role is its description).

test("Ctrl/Cmd click toggles, Shift click selects a range, Clear empties", async ({
    page,
}) => {
    const stage = await openExample(page, "multi-select");
    const org = tree(page, "Organization");
    await expect(org).toHaveAttribute("aria-multiselectable", "true");
    const count = stage.getByTestId("selection-count");
    await expect(count).toHaveText("Nobody selected");

    await row(item(org, "Grace Hopper")).click();
    await row(item(org, "Alan Turing")).click({ modifiers: ["ControlOrMeta"] });
    await expect(item(org, "Grace Hopper")).toHaveAttribute(
        "aria-selected",
        "true",
    );
    await expect(item(org, "Alan Turing")).toHaveAttribute(
        "aria-selected",
        "true",
    );
    await expect(count).toHaveText("2 selected");
    await expect(stage.getByTestId("selection-names")).toHaveText(
        "Grace Hopper, Alan Turing",
    );

    // a range: from Linus Torvalds to Barbara Liskov, in the visible order
    await row(item(org, "Linus Torvalds")).click();
    await row(item(org, "Barbara Liskov")).click({ modifiers: ["Shift"] });
    await expect(count).toHaveText("4 selected");
    await expect(item(org, "Margaret Hamilton")).toHaveAttribute(
        "aria-selected",
        "true",
    );
    await expect(item(org, "Grace Hopper")).toHaveAttribute(
        "aria-selected",
        "false",
    );

    await stage.getByRole("button", { name: "Clear selection" }).click();
    await expect(count).toHaveText("Nobody selected");
    await expect(org.locator('[aria-selected="true"]')).toHaveCount(0);
    await expect(
        stage.getByRole("button", { name: "Clear selection" }),
    ).toBeDisabled();
});

test("Select all selects every person", async ({ page }) => {
    const stage = await openExample(page, "multi-select");
    await stage.getByRole("button", { name: "Select all" }).click();
    await expect(stage.getByTestId("selection-count")).toHaveText("8 selected");
});
