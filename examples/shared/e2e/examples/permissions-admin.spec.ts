import { expect, type Page, test } from "@playwright/test";
import { item, itemAt, openExample, row, tree } from "../helpers";

// permissions-admin: an organization's areas, resources and actions, checked in cascade. Actions
// share names ("Read", "Delete"), so the spec reaches them by path. The page opens with the
// Editor role: under Projects › Repositories (/0/1/0), Read (granted by the security policy: locked),
// Create and Update are checked; Delete and Administer are not.

const REPOSITORIES = "/0/1/0";
const READ = "/0/1/0/0";
const DELETE = "/0/1/0/3";

const open = async (page: Page) => {
    const stage = await openExample(page, "permissions-admin");
    return {
        stage,
        permissions: tree(page, "Permissions"),
        changes: stage.getByTestId("changes"),
        role: stage.getByRole("combobox", { name: "Role" }),
    };
};

test("checks cascade, locked actions are disabled and say why", async ({
    page,
}) => {
    const { permissions, role } = await open(page);
    await expect(role).toHaveValue("Editor");
    await expect(itemAt(permissions, REPOSITORIES)).toHaveAttribute(
        "aria-checked",
        "mixed",
    );
    await expect(itemAt(permissions, DELETE)).toHaveAttribute(
        "aria-checked",
        "false",
    );
    const read = itemAt(permissions, READ);
    await expect(read).toHaveAttribute("aria-checked", "true");
    await expect(read).toHaveAttribute("aria-disabled", "true");
    await expect(read).toHaveAccessibleDescription(
        "Granted by the security policy",
    );
    await expect(item(permissions, "Billing")).toHaveAccessibleDescription(
        "2 of 6 granted",
    );
});

test("a parent's check grants its actions, and takes back all but the locked ones", async ({
    page,
}) => {
    const { permissions, changes, role } = await open(page);
    const repositories = itemAt(permissions, REPOSITORIES);
    await row(repositories).getByTestId("check").click();
    await expect(repositories).toHaveAttribute("aria-checked", "true");
    await expect(role).toHaveValue("Custom");
    await expect(changes).toHaveText(/^\s*2\sadded,\s0\sremoved\s*$/);
    // Space on the focused row does the same
    await row(repositories).click();
    await page.keyboard.press("Space");
    await expect(repositories).toHaveAttribute("aria-checked", "mixed");
    await expect(itemAt(permissions, READ)).toHaveAttribute(
        "aria-checked",
        "true",
    );
    await expect(changes).toHaveText(/^\s*0\sadded,\s2\sremoved\s*$/);
});

test("a locked action stays checked", async ({ page }) => {
    const { permissions } = await open(page);
    const read = itemAt(permissions, READ);
    await row(read).getByTestId("check").click();
    await row(read).click();
    await page.keyboard.press("Space");
    await expect(read).toHaveAttribute("aria-checked", "true");
});

test("a role preset fills the checks, and Discard restores the saved ones", async ({
    page,
}) => {
    const { stage, permissions, changes, role } = await open(page);
    await role.selectOption("Viewer");
    await expect(itemAt(permissions, "/0/1/0/1")).toHaveAttribute(
        "aria-checked",
        "false",
    );
    await expect(changes).toHaveText(/^\s*0\sadded,\s6\sremoved\s*$/);
    // People › Teams (/0/2/1): Editor grants all its actions, Viewer only Read
    await row(item(permissions, "People"))
        .locator('[data-tree-part="toggle"]')
        .click();
    await expect(itemAt(permissions, "/0/2/1")).toHaveAttribute(
        "aria-checked",
        "mixed",
    );
    await row(itemAt(permissions, "/0/2/1"))
        .locator('[data-tree-part="toggle"]')
        .click();
    await expect(itemAt(permissions, "/0/2/1/0")).toHaveAttribute(
        "aria-checked",
        "true",
    );
    await stage.getByRole("button", { name: "Discard" }).click();
    await expect(itemAt(permissions, "/0/2/1")).toHaveAttribute(
        "aria-checked",
        "true",
    );
    await expect(changes).toHaveText(/^\s*No\schanges\s*$/);
    await expect(role).toHaveValue("Editor");
    await expect(itemAt(permissions, "/0/1/0/1")).toHaveAttribute(
        "aria-checked",
        "true",
    );
});

test("saving a risky grant asks first", async ({ page }) => {
    const { stage, permissions, changes } = await open(page);
    const remove = itemAt(permissions, DELETE);
    await row(remove).getByTestId("check").click();
    await expect(remove).toHaveAccessibleDescription("Risky, Added");
    await stage.getByRole("button", { name: "Save" }).click();
    const dialog = stage.getByRole("dialog", {
        name: "Grant risky permissions?",
    });
    await expect(dialog).toContainText("Projects · Repositories: Delete");
    await dialog.getByRole("button", { name: "Grant and save" }).click();
    await expect(dialog).toBeHidden();
    await expect(changes).toHaveText(/^\s*No\schanges\s*$/);
    await expect(stage.getByTestId("notice")).toHaveText("Saved.");
    await expect(remove).toHaveAccessibleDescription("Risky");
});

test("a search highlights its matches and opens the folders around them", async ({
    page,
}) => {
    const { stage, permissions } = await open(page);
    await expect(item(permissions, "Webhooks")).toHaveCount(0);
    await stage
        .getByRole("searchbox", { name: "Search permissions" })
        .fill("webhook");
    await expect(stage.getByTestId("matches")).toHaveText("1 match");
    await expect(item(permissions, "Webhooks")).toHaveAttribute(
        "data-match",
        "",
    );
    await expect(item(permissions, "Billing")).toHaveAttribute(
        "data-dimmed",
        "",
    );
});
