import { veto } from "@fragiola/tree";
import { act, fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { Tree } from "../src";
import { FileTree, filesModel, itemElement } from "./tree";

function start(model = filesModel()) {
    render(<FileTree model={model} />);
    act(() => itemElement("app.ts").focus());
    fireEvent.keyDown(itemElement("app.ts"), { key: "F2" });
    const input = screen.getByRole("textbox", { name: "Name" });
    return { model, input: input as HTMLInputElement };
}

describe("inline rename", () => {
    it("starts with the label, focused and selected", () => {
        const { input } = start();
        expect(input).toHaveFocus();
        expect(input.value).toBe("app.ts");
        expect(input.selectionStart).toBe(0);
        expect(input.selectionEnd).toBe("app.ts".length);
        expect(input).toHaveAttribute("data-tree-part", "rename-input");
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
                                <Tree.RenameInput
                                    aria-label="Name"
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
