import { describe, expect, it } from "vitest";
import { defineComponent, h } from "vue";
import { createTreeModel, useTreeVirtualWindow } from "../src";
import { bigFileTree, bigTree, virtual } from "./big-tree";
import { render, settle, Tree } from "./tree";

const treeItems = () => [
    ...document.querySelectorAll<HTMLElement>('[role="treeitem"]'),
];

describe("Tree.VirtualItems", () => {
    it("renders only the rows in view plus the overscan, flat, between spacers", async () => {
        await render(() => bigFileTree());
        const items = treeItems();
        expect(items).toHaveLength(7);
        expect(document.querySelectorAll('[role="group"]')).toHaveLength(0);
        expect(items[1]).toHaveAttribute("aria-level", "2");
        expect(items[1]).toHaveAttribute("aria-setsize", "20");
        const tree = document.querySelector('[role="tree"]');
        for (const item of items) expect(item.parentElement).toBe(tree);
        const spacers = document.querySelectorAll<HTMLElement>(
            '[data-tree-part="spacer"]',
        );
        expect(spacers).toHaveLength(1);
        expect(spacers[0]?.style.height).toBe(`${(1050 - 7) * 20}px`);
    });

    it("End focuses the last item, rendered for it", async () => {
        await render(() => bigFileTree());
        const first = treeItems()[0] as HTMLElement;
        first.focus();
        await settle();
        first.dispatchEvent(
            new KeyboardEvent("keydown", { key: "End", bubbles: true }),
        );
        await settle();
        const focused = document.activeElement as HTMLElement;
        expect(focused).toHaveAttribute("data-tree-path", "/49/19");
        expect(focused).toHaveAttribute("tabindex", "0");
        expect(treeItems().length).toBeLessThanOrEqual(8);
    });

    it("renders nothing without the root's virtual", async () => {
        await render(() => bigFileTree(false));
        expect(treeItems()).toHaveLength(0);
    });

    it("useTreeVirtualWindow reads the window", async () => {
        let rows = -1;
        const Count = defineComponent({
            setup() {
                const window = useTreeVirtualWindow();
                return () => {
                    rows = window.value?.rows.length ?? 0;
                    return null;
                };
            },
        });
        await render(() =>
            h(
                Tree.Root,
                { model: createTreeModel(bigTree()), virtual },
                { default: () => [h(Count)] },
            ),
        );
        expect(rows).toBe(7);
    });
});
