import { expect, type Page, test } from "@playwright/test";
import { dragRow, item, openExample, row, tree } from "../helpers";

// task-board: projects, epics, tasks and subtasks. An item's accessible name is its label; its
// status, priority, assignee, due date or progress is its description. A task is done when it is
// checked. The board beside the tree shows the selected project's tasks in four columns.

const open = async (page: Page) => {
    const stage = await openExample(page, "task-board");
    const board = stage.getByRole("region", { name: "Board" });
    return {
        stage,
        projects: tree(page, "Projects"),
        board,
        column: (name: string) => board.getByRole("region", { name }),
    };
};

test("rows carry their work, and parents their progress", async ({ page }) => {
    const { projects, column } = await open(page);
    await expect(item(projects, "Order emails")).toHaveAccessibleDescription(
        "To do, low priority, Dee Ross, overdue since 2026-11-14",
    );
    await expect(item(projects, "Button component")).toHaveAttribute(
        "aria-checked",
        "mixed",
    );
    await expect(item(projects, "Design system")).toHaveAccessibleDescription(
        "2 of 4 done",
    );
    await expect(column("To do").getByTestId("card")).toHaveCount(4);
    // Button component's open work is all in review; Payment form's has started
    await expect(column("Doing").getByTestId("card")).toHaveCount(1);
    await expect(column("In review").getByTestId("card")).toHaveCount(1);
    await expect(column("Done").getByTestId("card")).toHaveCount(2);
});

test("Space checks a task done, and undo puts it back", async ({ page }) => {
    const { stage, projects, column } = await open(page);
    const fields = item(projects, "Form fields");
    await row(fields).click();
    await page.keyboard.press("Space");
    await expect(fields).toHaveAttribute("aria-checked", "true");
    await expect(
        column("Done").getByTestId("card").filter({ hasText: "Form fields" }),
    ).toHaveCount(1);
    await stage.getByRole("button", { name: "Undo" }).click();
    await expect(fields).toHaveAttribute("aria-checked", "false");
    await expect(
        column("To do").getByTestId("card").filter({ hasText: "Form fields" }),
    ).toHaveCount(1);
});

test("a row dropped on a board column takes its status", async ({ page }) => {
    const { projects, column } = await open(page);
    await dragRow(
        page,
        row(item(projects, "Order emails")),
        column("In review"),
    );
    await expect(item(projects, "Order emails")).toHaveAccessibleDescription(
        /^In review, /,
    );
    await expect(
        column("In review")
            .getByTestId("card")
            .filter({ hasText: "Order emails" }),
    ).toHaveCount(1);
});

test("a card's buttons move it along the board", async ({ page }) => {
    const { stage, projects, column } = await open(page);
    await stage
        .getByRole("button", { name: "Move Form fields to Doing" })
        .click();
    await expect(
        column("Doing").getByTestId("card").filter({ hasText: "Form fields" }),
    ).toHaveCount(1);
    await expect(item(projects, "Form fields")).toHaveAccessibleDescription(
        /^Doing, /,
    );
});

test("a task with subtasks moves to review with all its open work", async ({
    page,
}) => {
    const { stage, projects, column } = await open(page);
    await stage
        .getByRole("button", { name: "Move Payment form to In review" })
        .click();
    await expect(
        column("In review")
            .getByTestId("card")
            .filter({ hasText: "Payment form" }),
    ).toHaveCount(1);
    await expect(item(projects, "Card validation")).toHaveAccessibleDescription(
        /^In review, /,
    );
});

test("an epic dropped on a column changes nothing", async ({ page }) => {
    const { projects, column } = await open(page);
    await dragRow(page, row(item(projects, "Analytics")), column("Done"));
    await expect(column("Done").getByTestId("card")).toHaveCount(2);
    await expect(item(projects, "Analytics")).toHaveAccessibleDescription(
        "0 of 2 done",
    );
});

test("a subtask cannot leave its task", async ({ page }) => {
    const { projects } = await open(page);
    await dragRow(
        page,
        row(item(projects, "Card validation")),
        row(item(projects, "Checkout")),
    );
    await expect(item(projects, "Card validation")).toHaveAttribute(
        "aria-level",
        "4",
    );
});

test("a filter highlights its matches and expands to them", async ({
    page,
}) => {
    const { stage, projects } = await open(page);
    await stage
        .getByRole("combobox", { name: "Filter by assignee" })
        .selectOption({ label: "Chen Wei" });
    await expect(stage.getByTestId("matches")).toHaveText("4 matches");
    await expect(item(projects, "Color tokens")).toHaveAttribute(
        "data-dimmed",
        "",
    );
    await expect(item(projects, "Payment form")).not.toHaveAttribute(
        "data-dimmed",
    );
    await expect(item(projects, "Sync queue")).toHaveCount(0);
    await stage.getByRole("button", { name: "Expand to matches" }).click();
    await expect(item(projects, "Sync queue")).toBeVisible();
});

test("Add task works before any row has focus: into the selected project's first epic", async ({
    page,
}) => {
    const { stage, projects } = await open(page);
    await stage.getByRole("button", { name: "Add task" }).click();
    const input = stage.getByRole("textbox", { name: "Rename New task" });
    await input.press("Escape");
    await expect(item(projects, "New task")).toHaveAttribute("aria-level", "3");
    await expect(item(projects, "New task")).toHaveAttribute(
        "aria-checked",
        "false",
    );
});

test("a task added from the toolbar is named at once, and Enter adds the next", async ({
    page,
}) => {
    const { stage, projects } = await open(page);
    await row(item(projects, "Form fields")).click();
    await stage.getByRole("button", { name: "Add task" }).click();
    const input = stage.getByRole("textbox", { name: "Rename New task" });
    await expect(input).toBeFocused();
    await input.fill("Icons");
    await input.press("Enter");
    await expect(item(projects, "Icons")).toHaveAttribute("aria-level", "3");
    const next = stage.getByRole("textbox", { name: "Rename New task" });
    await expect(next).toBeFocused();
    await next.press("Escape");
    await expect(item(projects, "New task")).toHaveAttribute("aria-level", "3");
});
