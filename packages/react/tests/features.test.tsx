import { render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { createTreeModel, Tree } from "../src";
import { selection } from "../src/selection";
import { FileTree, files, itemElement } from "./tree";

afterEach(() => {
    vi.restoreAllMocks();
});

function Bare(props: { features?: readonly never[] }) {
    return (
        <Tree.Root<never>
            defaultTree={
                {
                    version: 1,
                    rootItemIds: ["a"],
                    items: { a: { kind: "file", label: "a" } },
                } as never
            }
            aria-label="Bare"
            {...(props as object)}
        >
            <Tree.Items>
                {(item) => (
                    <Tree.Item item={item}>
                        <Tree.ItemContent>{item.label}</Tree.ItemContent>
                    </Tree.Item>
                )}
            </Tree.Items>
        </Tree.Root>
    );
}

describe("features on the root", () => {
    it("a bare tree says nothing about a selection", () => {
        render(<Bare />);
        expect(screen.getByRole("tree")).not.toHaveAttribute(
            "aria-multiselectable",
        );
        expect(screen.getByRole("treeitem")).not.toHaveAttribute(
            "aria-selected",
        );
    });

    it("an item gets its features' ARIA, and every part of it their data-*", () => {
        const json = files({
            settings: { selectionMode: "multiple" },
            selectedItemIds: ["app"],
        });
        render(<FileTree defaultTree={json} />);
        expect(screen.getByRole("tree")).toHaveAttribute(
            "aria-multiselectable",
            "true",
        );
        const app = itemElement("app.ts");
        expect(app).toHaveAttribute("aria-selected", "true");
        expect(app).toHaveAttribute("data-selected", "");
        const content = app.querySelector('[data-tree-part="content"]');
        expect(content).toHaveAttribute("data-selected", "");
        expect(content).not.toHaveAttribute("aria-selected");
    });

    it("warns once, and ignores it, when a feature's prop has no feature", () => {
        const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
        const model = createTreeModel(files());
        const props = { selectedItemIds: ["app"] } as object;
        const { rerender } = render(
            <Tree.Root model={model} aria-label="Files" {...props} />,
        );
        rerender(<Tree.Root model={model} aria-label="Files" {...props} />);
        expect(warn).toHaveBeenCalledTimes(1);
        expect(warn.mock.calls[0]?.[0]).toContain(
            "selectedItemIds needs the selection feature",
        );
        expect(screen.getByRole("tree")).not.toHaveAttribute("selectedItemIds");
        expect("selectedItemIds" in model.state).toBe(false);
    });

    it("warns once when the features prop changes after the root created its model", () => {
        const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
        const { rerender } = render(<FileTree defaultTree={files()} />);
        const other = [selection({ mode: "multiple" })] as const;
        rerender(<FileTree defaultTree={files()} features={other as never} />);
        rerender(<FileTree defaultTree={files()} features={other as never} />);
        expect(warn).toHaveBeenCalledTimes(1);
        expect(warn.mock.calls[0]?.[0]).toContain(
            "the features prop changed after the root created its model",
        );
    });
});
