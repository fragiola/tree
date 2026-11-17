import { Component } from "@angular/core";
import { describe, expect, it } from "vitest";
import {
    createTreeModel,
    injectTreeVirtualWindow,
    TREE,
} from "../src/public-api";
import { BigTree, bigTree, virtual } from "./big-tree";
import { render, settle } from "./tree";

const treeItems = () => [
    ...document.querySelectorAll<HTMLElement>('[role="treeitem"]'),
];

describe("ng-template[treeVirtualItems]", () => {
    it("renders only the rows in view plus the overscan, flat, between spacers", async () => {
        await render(BigTree);
        const items = treeItems();
        expect(items).toHaveLength(7);
        expect(items[1]).toHaveAttribute("aria-level", "2");
        expect(items[1]).toHaveAttribute("aria-setsize", "20");
        expect(items[1]).toHaveAttribute("data-offset", "20");
        const tree = document.querySelector('[role="tree"]');
        for (const item of items) expect(item.parentElement).toBe(tree);
        const spacers = document.querySelectorAll<HTMLElement>(
            '[data-tree-part="spacer"]',
        );
        expect(spacers).toHaveLength(1);
        expect(spacers[0]?.style.height).toBe(`${(1050 - 7) * 20}px`);
        // the spacer comes after the last row
        expect(items.at(-1)?.nextElementSibling).toBe(spacers[0]);
    });

    it("End focuses the last item, rendered for it, the spacers placed around the rows", async () => {
        await render(BigTree);
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
        const tree = document.querySelector('[role="tree"]') as HTMLElement;
        const elements = [...tree.children].map(
            (element) => element.getAttribute("data-tree-part") ?? "",
        );
        expect(elements[0]).toBe("spacer");
        expect(elements.slice(1).every((part) => part === "item")).toBe(true);
    });

    it("renders nothing without the root's virtual", async () => {
        const rendered = await render(BigTree, { virtual: undefined });
        expect(treeItems()).toHaveLength(0);
        rendered.destroy();
    });

    it("injectTreeVirtualWindow reads the window", async () => {
        @Component({
            selector: "test-count",
            template: "",
        })
        class Count {
            readonly window = injectTreeVirtualWindow();
        }
        @Component({
            selector: "test-host",
            imports: [TREE, Count],
            template: `<div [treeRoot]="model" [virtual]="virtual"><test-count /></div>`,
        })
        class Host {
            readonly model = createTreeModel(bigTree());
            readonly virtual = virtual;
        }
        const rendered = await render(Host);
        const count = rendered.fixture.debugElement.query(
            (node) => node.componentInstance instanceof Count,
        )?.componentInstance as Count | undefined;
        expect(count?.window()?.rows.length).toBe(7);
    });
});
