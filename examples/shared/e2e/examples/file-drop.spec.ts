import { expect, type JSHandle, type Locator, test } from "@playwright/test";
import { dragRow, item, openExample, pointIn, row, tree } from "../helpers";

// file-drop: files from the desktop dropped into the tree (native drag events, `foreignDrop`), and
// rows dragged out of the tree onto a trash zone (`dropOutside`). A real desktop drag cannot be
// scripted: the spec builds a `DataTransfer` in the page and dispatches the drag events a browser
// fires over the tree.

/** A `DataTransfer` built in the page: files by name and content, or plain text. */
function transfer(
    page: import("@playwright/test").Page,
    data: { files?: Record<string, string>; text?: string },
): Promise<JSHandle<DataTransfer>> {
    return page.evaluateHandle(({ files, text }) => {
        const dataTransfer = new DataTransfer();
        for (const [name, content] of Object.entries(files ?? {}))
            dataTransfer.items.add(
                new File([content], name, { type: "text/plain" }),
            );
        if (text !== undefined) dataTransfer.setData("text/plain", text);
        return dataTransfer;
    }, data);
}

/** Drags `dataTransfer` over `target` (at a fraction of its height), as a browser would. */
async function dragOver(
    target: Locator,
    dataTransfer: JSHandle<DataTransfer>,
    fraction = 0.5,
) {
    const { x, y } = await pointIn(target, fraction);
    const init = { dataTransfer, clientX: x, clientY: y };
    await target.dispatchEvent("dragenter", init);
    await target.dispatchEvent("dragover", init);
    return init;
}

test("files dropped on a folder are added to it, with the target shown first", async ({
    page,
}) => {
    await openExample(page, "file-drop");
    const files = tree(page);
    // src is expanded: the files show in it once dropped
    const src = row(item(files, "src"));
    const dataTransfer = await transfer(page, {
        files: { "notes.txt": "hello", "todo.md": "- [ ] ship" },
    });
    const init = await dragOver(src, dataTransfer);
    await expect(files).toHaveAttribute("data-dragging", "");
    await expect(src).toHaveAttribute("data-drop-position", "inside");
    await expect(
        files.locator('[data-tree-part="drop-indicator"]'),
    ).toHaveAttribute("data-drop-position", "inside");
    await expect(files.getByRole("status")).toHaveText(
        "Drop the files into src.",
    );
    await src.dispatchEvent("drop", init);
    await expect(item(files, "notes.txt")).toHaveAttribute("aria-level", "2");
    await expect(item(files, "todo.md")).toHaveAttribute("aria-level", "2");
    await expect(files).not.toHaveAttribute("data-dragging");
    await expect(files.getByRole("status")).toHaveText(
        "Added the files into src.",
    );
});

test("a drag of text shows no target, and leaving the tree clears it", async ({
    page,
}) => {
    await openExample(page, "file-drop");
    const files = tree(page);
    const text = await transfer(page, { text: "hello" });
    await dragOver(row(item(files, "src")), text);
    await expect(files.locator("[data-drop-position]")).toHaveCount(0);
    const dataTransfer = await transfer(page, { files: { "a.txt": "a" } });
    await dragOver(row(item(files, "README.md")), dataTransfer, 0.9);
    await expect(row(item(files, "README.md"))).toHaveAttribute(
        "data-drop-position",
        "after",
    );
    await files.dispatchEvent("dragleave", {
        dataTransfer,
        clientX: 0,
        clientY: 0,
    });
    await expect(files).not.toHaveAttribute("data-dragging");
    await expect(files.locator("[data-drop-position]")).toHaveCount(0);
});

test("a row dragged onto the trash is deleted; released elsewhere it stays", async ({
    page,
}) => {
    const stage = await openExample(page, "file-drop");
    const files = tree(page);
    const trash = stage.getByTestId("trash");
    // over the trash, the trash shows it
    const start = await pointIn(row(item(files, "README.md")));
    await page.mouse.move(start.x, start.y);
    await page.mouse.down();
    await page.mouse.move(start.x, start.y + 8, { steps: 4 });
    const end = await pointIn(trash);
    await page.mouse.move(end.x, end.y, { steps: 8 });
    await expect(trash).toHaveAttribute("data-over", "");
    await page.mouse.up();
    await expect(item(files, "README.md")).toHaveCount(0);
    await expect(trash).not.toHaveAttribute("data-over");
    await expect(files.getByRole("status")).toHaveText("Deleted 1 item.");
    // released outside the tree but not on the trash: cancelled
    await dragRow(
        page,
        row(item(files, "package.json")),
        stage.getByText("Drop files from your computer"),
    );
    await expect(item(files, "package.json")).toHaveCount(1);
    await expect(files.getByRole("status")).toHaveText("Cancelled.");
});
