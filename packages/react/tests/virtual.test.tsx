import { act, fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { createTreeModel, type ItemOf, Tree, type TreeJson } from "../src";
import {
    useTreeVirtualWindow,
    VirtualItems,
    virtualization,
} from "../src/virtualization";
import type { FileTypes } from "./tree";

// 50 folders of 20 files, all expanded: 1050 visible items
function bigTree(): TreeJson<FileTypes> {
    const items: TreeJson<FileTypes>["items"] = {};
    const rootItemIds: string[] = [];
    for (let f = 0; f < 50; f++) {
        const childItemIds: string[] = [];
        for (let i = 0; i < 20; i++) {
            childItemIds.push(`f${f}-${i}`);
            items[`f${f}-${i}`] = {
                kind: "file",
                label: `file ${f}.${i}`,
                data: { size: i },
            };
        }
        rootItemIds.push(`f${f}`);
        items[`f${f}`] = { kind: "folder", label: `folder ${f}`, childItemIds };
    }
    return { version: 1, rootItemIds, items, expandedItemIds: rootItemIds };
}

const virtual = virtualization({
    rowSize: 20,
    overscan: 2,
    initialViewportSize: 100,
});

function Row({ item }: { item: ItemOf<FileTypes> }) {
    return (
        <Tree.Item item={item}>
            <Tree.ItemContent>
                <Tree.Toggle />
                <span>{item.label}</span>
            </Tree.ItemContent>
        </Tree.Item>
    );
}

function BigTree({ withVirtual = true }: { withVirtual?: boolean }) {
    return (
        <Tree.Root<FileTypes>
            aria-label="Files"
            model={
                withVirtual
                    ? createTreeModel<FileTypes, readonly [typeof virtual]>(
                          bigTree(),
                          { features: [virtual] },
                      )
                    : createTreeModel<FileTypes>(bigTree())
            }
            style={{ height: 100, overflow: "auto" }}
        >
            <VirtualItems<FileTypes>>
                {(item) => <Row item={item} />}
            </VirtualItems>
        </Tree.Root>
    );
}

describe("VirtualItems", () => {
    it("renders only the rows in view plus the overscan, flat, between spacers", () => {
        render(<BigTree />);
        const items = screen.getAllByRole("treeitem");
        // 100px / 20px = 5 rows in view, 2 after
        expect(items).toHaveLength(7);
        expect(screen.queryAllByRole("group")).toHaveLength(0);
        expect(items[0]).toHaveAttribute("aria-level", "1");
        expect(items[0]).toHaveAttribute("aria-posinset", "1");
        expect(items[0]).toHaveAttribute("aria-setsize", "50");
        expect(items[1]).toHaveAttribute("aria-level", "2");
        expect(items[1]).toHaveAttribute("aria-setsize", "20");
        expect(items[1]).toHaveAttribute("data-tree-path", "/0/0");
        // every item a sibling of the others, in the root
        const tree = screen.getByRole("tree");
        for (const item of items) expect(item.parentElement).toBe(tree);
        const spacers = tree.querySelectorAll('[data-tree-part="spacer"]');
        expect(spacers).toHaveLength(1);
        expect(spacers[0]).toHaveAttribute("aria-hidden", "true");
        expect((spacers[0] as HTMLElement).style.height).toBe(
            `${(1050 - 7) * 20}px`,
        );
        expect(items[0]).toHaveAttribute("tabindex", "0");
    });

    it("End focuses the last item, rendered for it", async () => {
        render(<BigTree />);
        const first = screen.getAllByRole("treeitem")[0] as HTMLElement;
        act(() => first.focus());
        await act(async () => {
            fireEvent.keyDown(first, { key: "End" });
        });
        const focused = document.activeElement as HTMLElement;
        expect(focused).toHaveAttribute("role", "treeitem");
        expect(focused).toHaveAttribute("aria-posinset", "20");
        expect(focused).toHaveAttribute("data-tree-path", "/49/19");
        expect(focused).toHaveAttribute("tabindex", "0");
        // the window moved to the end: the first rows are spacers now
        const tree = screen.getByRole("tree");
        expect(tree.firstElementChild).toHaveAttribute(
            "data-tree-part",
            "spacer",
        );
        expect(screen.getAllByRole("treeitem").length).toBeLessThanOrEqual(8);
    });

    it("renders nothing without the root's virtual", () => {
        render(<BigTree withVirtual={false} />);
        expect(screen.queryAllByRole("treeitem")).toHaveLength(0);
    });

    it("useTreeVirtualWindow reads the window", () => {
        let rows = -1;
        function Count() {
            rows = useTreeVirtualWindow()?.rows.length ?? 0;
            return null;
        }
        render(
            <Tree.Root
                model={createTreeModel<FileTypes, readonly [typeof virtual]>(
                    bigTree(),
                    { features: [virtual] },
                )}
            >
                <Count />
            </Tree.Root>,
        );
        expect(rows).toBe(7);
    });
});
