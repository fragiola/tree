import {
    type AnyTypes,
    type CommandError,
    type ItemOf,
    veto,
} from "@fragiola/tree";
import { act, fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { Tree, useTree, useTreeItem } from "../src";
import { useTreeItemRename } from "../src/rename";
import { type FEATURES, FileTree, filesModel, itemElement } from "./tree";

function start(model = filesModel()) {
    render(<FileTree model={model} />);
    act(() => itemElement("app.ts").focus());
    fireEvent.keyDown(itemElement("app.ts"), { key: "F2" });
    const input = screen.getByRole("textbox", { name: "Name" });
    return { model, input: input as HTMLInputElement };
}

function Editor({
    item,
    onRenameError,
}: {
    item: ItemOf<AnyTypes>;
    onRenameError: (error: CommandError) => void;
}) {
    const { state, props } = useTreeItemRename(item, { onRenameError });
    return state.renaming ? (
        <input
            {...props}
            aria-label="Name"
            data-state={state.invalid ? "invalid" : ""}
        />
    ) : null;
}

/** Renaming by hand: the item's state and the engine's actions, no hook. */
function ManualEditor({ item }: { item: ItemOf<AnyTypes> }) {
    const { engine } = useTree<AnyTypes, typeof FEATURES>();
    const { state } = useTreeItem(item);
    if (!state.renaming) return null;
    return (
        <input
            aria-label="Name"
            defaultValue={item.label}
            onKeyDown={(event) => {
                if (event.key === "Enter")
                    engine.run("commit-rename", {
                        itemId: item.id,
                        label: event.currentTarget.value,
                    });
                if (event.key === "Escape")
                    engine.run("cancel-rename", { itemId: item.id });
            }}
        />
    );
}

describe("inline rename", () => {
    it("starts with the label, focused and selected", () => {
        const { input } = start();
        expect(input).toHaveFocus();
        expect(input.value).toBe("app.ts");
        expect(input.selectionStart).toBe(0);
        expect(input.selectionEnd).toBe("app.ts".length);
        // the app's own element: the hook adds no part attribute
        expect(input).not.toHaveAttribute("data-tree-part");
        expect(itemElement("app.ts")).toHaveAttribute("data-renaming", "");
    });

    it("commits on Enter (item.rename) and gives focus back to the item", () => {
        const { model, input } = start();
        fireEvent.change(input, { target: { value: "main.ts" } });
        fireEvent.keyDown(input, { key: "Enter" });
        expect(model.get("item-by", { id: "app" })?.label).toBe("main.ts");
        expect(screen.queryByRole("textbox")).toBeNull();
        expect(itemElement("main.ts")).toHaveFocus();
    });

    it("runs item.rename once on Enter", () => {
        const model = filesModel();
        const commands: string[] = [];
        model.subscribe((event) => commands.push(event.command));
        const { input } = start(model);
        commands.length = 0;
        fireEvent.change(input, { target: { value: "main.ts" } });
        fireEvent.keyDown(input, { key: "Enter" });
        expect(commands).toEqual(["item.rename"]);
    });

    it("leaves focus where it went when a blur commits", () => {
        const model = filesModel();
        render(
            <>
                <button type="button">Outside</button>
                <FileTree model={model} />
            </>,
        );
        act(() => itemElement("app.ts").focus());
        fireEvent.keyDown(itemElement("app.ts"), { key: "F2" });
        const input = screen.getByRole("textbox", { name: "Name" });
        fireEvent.change(input, { target: { value: "moved.ts" } });
        act(() => screen.getByRole("button", { name: "Outside" }).focus());
        expect(model.get("item-by", { id: "app" })?.label).toBe("moved.ts");
        expect(screen.getByRole("button", { name: "Outside" })).toHaveFocus();
    });

    it("gives focus back to the item when the app ends the rename", () => {
        const { model } = start();
        act(() => {
            model.run("item.cancel-rename", { itemId: "app" });
        });
        expect(itemElement("app.ts")).toHaveFocus();
    });

    it("keeps focus and the typed text in the editor through an unrelated change", () => {
        const { model, input } = start();
        fireEvent.change(input, { target: { value: "half" } });
        act(() => {
            model.run("item.toggle-check", { itemId: "readme" });
        });
        expect(input).toHaveFocus();
        expect(input.value).toBe("half");
        expect(model.state.renamingItemId).toBe("app");
    });

    it("cancels on Escape", () => {
        const { model, input } = start();
        fireEvent.change(input, { target: { value: "x" } });
        fireEvent.keyDown(input, { key: "Escape" });
        expect(model.get("item-by", { id: "app" })?.label).toBe("app.ts");
        expect(model.state.renamingItemId).toBeNull();
        expect(itemElement("app.ts")).toHaveFocus();
    });

    it("commits on blur", () => {
        const { model, input } = start();
        fireEvent.change(input, { target: { value: "blurred.ts" } });
        fireEvent.blur(input);
        expect(model.get("item-by", { id: "app" })?.label).toBe("blurred.ts");
    });

    it("stays open and invalid when a middleware refuses the label", () => {
        const model = filesModel();
        model.use((ctx, next) =>
            ctx.command === "item.rename" &&
            !(ctx.payload as { label: string }).label.endsWith(".ts")
                ? veto("a file ends in .ts")
                : next(),
        );
        const onRenameError = vi.fn();
        render(
            <Tree.Root model={model} aria-label="Files">
                <Tree.Items>
                    {(item) => (
                        <Tree.Item item={item}>
                            <Tree.ItemContent>
                                {item.label}
                                <Editor
                                    item={item}
                                    onRenameError={onRenameError}
                                />
                            </Tree.ItemContent>
                        </Tree.Item>
                    )}
                </Tree.Items>
            </Tree.Root>,
        );
        act(() => screen.getByRole("treeitem", { name: "readme.md" }).focus());
        fireEvent.keyDown(document.activeElement ?? document.body, {
            key: "F2",
        });
        const input = screen.getByRole("textbox", { name: "Name" });
        fireEvent.change(input, { target: { value: "app.js" } });
        fireEvent.keyDown(input, { key: "Enter" });
        expect(input).toBeInTheDocument();
        expect(input).toHaveAttribute("aria-invalid", "true");
        expect(onRenameError).toHaveBeenCalledWith(
            expect.objectContaining({ code: "vetoed" }),
        );
        expect(model.get("item-by", { id: "readme" })?.label).toBe("readme.md");
        fireEvent.change(input, { target: { value: "app2.ts" } });
        expect(input).not.toHaveAttribute("aria-invalid");
        // leaving it with a refused label cancels
        fireEvent.change(input, { target: { value: "nope" } });
        fireEvent.blur(input);
        expect(model.state.renamingItemId).toBeNull();
    });

    it("does not start a drag or a selection from a press in the input", () => {
        const { model, input } = start();
        fireEvent.pointerDown(input, { clientX: 5, clientY: 25 });
        fireEvent.click(input);
        expect(model.state.selectedItemIds).toEqual([]);
        expect(model.state.renamingItemId).toBe("app");
    });
});

describe("renaming by hand", () => {
    function renderManual(model = filesModel()) {
        render(
            <Tree.Root model={model} aria-label="Files">
                <Tree.Items>
                    {(item) => (
                        <Tree.Item item={item}>
                            <Tree.ItemContent>
                                {item.label}
                                <ManualEditor item={item} />
                            </Tree.ItemContent>
                        </Tree.Item>
                    )}
                </Tree.Items>
            </Tree.Root>,
        );
        act(() => screen.getByRole("treeitem", { name: "readme.md" }).focus());
        fireEvent.keyDown(document.activeElement ?? document.body, {
            key: "F2",
        });
        return model;
    }

    it("commits with commit-rename, and focus goes back to the item", () => {
        const model = renderManual();
        const input = screen.getByRole("textbox", { name: "Name" });
        act(() => input.focus());
        fireEvent.change(input, { target: { value: "notes.md" } });
        fireEvent.keyDown(input, { key: "Enter" });
        expect(model.get("item-by", { id: "readme" })?.label).toBe("notes.md");
        expect(screen.queryByRole("textbox")).toBeNull();
        expect(
            screen.getByRole("treeitem", { name: "notes.md" }),
        ).toHaveFocus();
    });

    it("cancels with cancel-rename", () => {
        const model = renderManual();
        const input = screen.getByRole("textbox", { name: "Name" });
        act(() => input.focus());
        fireEvent.keyDown(input, { key: "Escape" });
        expect(model.state.renamingItemId).toBeNull();
        expect(
            screen.getByRole("treeitem", { name: "readme.md" }),
        ).toHaveFocus();
    });
});
