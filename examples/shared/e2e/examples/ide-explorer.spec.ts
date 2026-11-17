import { expect, type Page, test } from "@playwright/test";
import { dragRow, item, openExample, row, tree } from "../helpers";

// ide-explorer: a code editor's workbench. A file's accessible name is its label and its git
// status its description; the open editors are a list of buttons beside the tree, the file shown
// the current one (`aria-current`).

const open = async (page: Page) => {
    const stage = await openExample(page, "ide-explorer");
    return { stage, files: tree(page, "Project files") };
};

test("files carry their git status, and folders holding a change are marked", async ({
    page,
}) => {
    const { stage, files } = await open(page);
    await expect(item(files, "app.tsx")).toHaveAccessibleDescription(
        "modified",
    );
    await expect(item(files, "button.tsx")).toHaveAccessibleDescription(
        "added",
    );
    await expect(item(files, "main.tsx")).not.toHaveAttribute(
        "aria-describedby",
    );
    await expect(
        row(item(files, "src")).getByTestId("changed-folder"),
    ).toBeVisible();
    await expect(
        row(item(files, "public")).getByTestId("changed-folder"),
    ).toHaveCount(0);
    await expect(stage.getByTestId("changes")).toHaveText("3 modified, 3 new");
});

test("node_modules lists its packages when it is opened", async ({ page }) => {
    const { files } = await open(page);
    const modules = item(files, "node_modules");
    await expect(item(files, "react")).toHaveCount(0);
    await row(modules).click();
    await expect(modules).toHaveAttribute("aria-expanded", "true");
    await expect(item(files, "react")).toBeVisible();
    await expect(modules).not.toHaveAttribute("aria-busy");
});

test("a new file goes into the focused folder, untracked, its name being edited", async ({
    page,
}) => {
    const { stage, files } = await open(page);
    await row(item(files, "hooks")).click();
    await stage.getByRole("button", { name: "New file" }).click();
    const input = stage.getByRole("textbox", { name: "Rename untitled.ts" });
    await expect(input).toBeFocused();
    await input.fill("use-files.ts");
    await input.press("Enter");
    const created = item(files, "use-files.ts");
    await expect(created).toHaveAttribute("aria-level", "3");
    await expect(created).toHaveAccessibleDescription("untracked");
    await expect(stage.getByTestId("changes")).toHaveText("3 modified, 4 new");
});

test("a name taken in the folder is refused, and the input stays open", async ({
    page,
}) => {
    const { stage, files } = await open(page);
    await row(item(files, "button.tsx")).click();
    await page.keyboard.press("F2");
    const input = stage.getByRole("textbox", { name: "Rename button.tsx" });
    await input.fill("tabs.tsx");
    await input.press("Enter");
    await expect(input).toHaveAttribute("aria-invalid", "true");
    await expect(stage.getByTestId("notice")).toHaveText(
        "“tabs.tsx” already exists here.",
    );
    await input.press("Escape");
    await expect(item(files, "button.tsx")).toBeVisible();
});

test("Delete removes the selection, but never node_modules", async ({
    page,
}) => {
    const { stage, files } = await open(page);
    await row(item(files, "tabs.tsx")).click();
    await page.keyboard.press("Delete");
    await expect(item(files, "tabs.tsx")).toHaveCount(0);
    await row(item(files, "node_modules")).click();
    await stage.getByRole("button", { name: "Delete" }).click();
    await expect(item(files, "node_modules")).toBeVisible();
    await expect(stage.getByTestId("notice")).toHaveText(
        "node_modules belongs to the package manager.",
    );
});

test("a file dragged onto a folder moves into it", async ({ page }) => {
    const { files } = await open(page);
    await dragRow(page, row(item(files, "README.md")), row(item(files, "src")));
    await expect(item(files, "README.md")).toHaveAttribute("aria-level", "2");
});

test("selecting a file opens its editor; a tab selects its file again", async ({
    page,
}) => {
    const { stage, files } = await open(page);
    const tabs = stage.getByRole("list", { name: "Open editors" });
    const tab = (name: string) =>
        tabs.getByRole("button", { name, exact: true });
    await expect(tab("app.tsx")).toHaveAttribute("aria-current", "true");
    await row(item(files, "main.tsx")).click();
    await expect(tab("main.tsx")).toHaveAttribute("aria-current", "true");
    await expect(stage.getByRole("navigation", { name: "Path" })).toHaveText(
        /^\s*src\s*main\.tsx\s*$/,
    );
    await expect(stage.getByTestId("code")).toContainText("createRoot");
    await tab("app.tsx").click();
    await expect(item(files, "app.tsx")).toHaveAttribute(
        "aria-selected",
        "true",
    );
    await stage.getByRole("button", { name: "Close app.tsx" }).click();
    await expect(tab("app.tsx")).toHaveCount(0);
    await expect(tab("main.tsx")).toHaveAttribute("aria-current", "true");
});

test("a closed editor stays closed while the tree changes", async ({
    page,
}) => {
    const { stage } = await open(page);
    const tabs = stage.getByRole("list", { name: "Open editors" });
    await stage.getByRole("button", { name: "Close app.tsx" }).click();
    await expect(tabs.getByRole("button")).toHaveCount(0);
    await stage.getByRole("button", { name: "Collapse folders" }).click();
    await expect(tabs.getByRole("button")).toHaveCount(0);
    await expect(
        stage.getByText("Select a file in the explorer to open it."),
    ).toBeVisible();
});

test("reveal active file opens its folders and focuses it", async ({
    page,
}) => {
    const { stage, files } = await open(page);
    await stage.getByRole("button", { name: "Collapse folders" }).click();
    await expect(item(files, "app.tsx")).toHaveCount(0);
    await stage.getByRole("button", { name: "Reveal active file" }).click();
    await expect(item(files, "app.tsx")).toBeFocused();
    await expect(item(files, "app.tsx")).toHaveAttribute(
        "aria-selected",
        "true",
    );
});
