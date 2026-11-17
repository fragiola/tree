// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from "vitest";
import { createTreeForeignDrop } from "../../src/dnd/foreign-drop";
import { createTreeEngine } from "../../src/engine/tree-engine";
import { createTreeVirtualizer } from "../../src/virtual/virtualizer";
import { dataTransfer, mount, nativeDrag, pointer, wait } from "../engine/dom";
import { filesModel } from "../fixture";
import { flatModel, mountVirtual, type VirtualMounted } from "./dom";

let mounted: VirtualMounted | undefined;
afterEach(() => {
    mounted?.unmount();
    mounted = undefined;
    vi.unstubAllGlobals();
});

const ROW = 20;
const fixed = createTreeVirtualizer({ rowSize: ROW, overscan: 4 });

describe("the virtualizer", () => {
    it("is off without the option: no window, every row rendered as before", () => {
        const engine = createTreeEngine(filesModel());
        expect(engine.get("virtual-window")).toBeNull();
        engine.destroy();
    });

    it("holds one options object for every tree that uses it", () => {
        const virtual = createTreeVirtualizer({ rowSize: 24 });
        expect(Object.isFrozen(virtual)).toBe(true);
        expect(virtual.options).toEqual({ rowSize: 24 });
    });

    it("renders only the rows in view plus the overscan, with aria from the visible items", () => {
        mounted = mountVirtual(flatModel(1000), fixed);
        const window = mounted.engine.get("virtual-window");
        // 200px / 20px = 10 rows in view, 4 after (none before the top)
        expect(window?.start).toBe(0);
        expect(window?.end).toBe(14);
        expect(window?.totalSize).toBe(20_000);
        expect(window?.spaceAfter).toBe(20_000 - 14 * ROW);
        expect(window?.rows[3]).toMatchObject({
            itemId: "n3",
            index: 3,
            offset: 60,
            size: ROW,
            level: 1,
            posinset: 4,
            setsize: 1000,
            spaceBefore: 0,
        });
        expect(mounted.rendered()).toHaveLength(14);
    });

    it("follows the scroll: the window moves only when the view leaves the overscan", () => {
        mounted = mountVirtual(flatModel(1000), fixed);
        const first = mounted.engine.get("virtual-window");
        mounted.scroll(40);
        expect(mounted.engine.get("virtual-window")).toBe(first);
        mounted.scroll(10_000);
        const window = mounted.engine.get("virtual-window");
        expect(window?.start).toBe(496);
        expect(window?.end).toBe(514);
        // the tab stop (the first item) stays rendered, at its own offset
        expect(window?.rows[0]).toMatchObject({ itemId: "n0", spaceBefore: 0 });
        expect(window?.rows[1]).toMatchObject({
            itemId: "n496",
            spaceBefore: 496 * ROW - ROW,
        });
        expect(mounted.rendered()).toEqual([
            "n0",
            ...Array.from({ length: 18 }, (_, i) => `n${496 + i}`),
        ]);
    });

    it("windows 200 000 visible items, and a scroll recomputes in well under a frame", () => {
        const model = flatModel(200_000);
        mounted = mountVirtual(model, fixed, { viewport: 600 });
        const window = mounted.engine.get("virtual-window");
        expect(window?.rows.length).toBeLessThanOrEqual(600 / ROW + 2 * 4 + 1);
        expect(mounted.rendered().length).toBe(window?.rows.length);
        const steps = 500;
        const start = performance.now();
        for (let i = 1; i <= steps; i++) {
            mounted.scroll(i * 7919);
            mounted.engine.get("virtual-window");
        }
        const perScroll = (performance.now() - start) / steps;
        // a frame is 16ms; the scroll, the window and the hand-written render take a fraction
        expect(perScroll).toBeLessThan(4);
        expect(mounted.rendered().length).toBeLessThanOrEqual(
            600 / ROW + 2 * 4 + 1,
        );
    }, 60_000);

    it("measured rows: 200 000 estimated rows read and update in O(log n)", () => {
        const model = flatModel(200_000);
        mounted = mountVirtual(
            model,
            createTreeVirtualizer({ estimateRowSize: 24 }),
            {
                viewport: 600,
            },
        );
        const start = performance.now();
        for (let i = 1; i <= 500; i++) {
            mounted.scroll(i * 9001);
            mounted.engine.get("virtual-window");
        }
        expect((performance.now() - start) / 500).toBeLessThan(4);
    }, 60_000);

    it("scroll-to scrolls to an item outside the window, which renders it", () => {
        mounted = mountVirtual(flatModel(1000), fixed);
        expect(mounted.item("n800")).toBeUndefined();
        expect(mounted.engine.run("scroll-to", { itemId: "n800" }).ok).toBe(
            true,
        );
        expect(mounted.root.scrollTop).toBe(801 * ROW - 200);
        expect(mounted.item("n800")).toBeDefined();
        mounted.engine.run("scroll-to", { itemId: "n10", align: "start" });
        expect(mounted.root.scrollTop).toBe(10 * ROW);
        expect(mounted.engine.check("scroll-to", { itemId: "nope" }).ok).toBe(
            false,
        );
    });

    it("scroll-to refuses an item that is not visible", () => {
        mounted = mountVirtual(filesModel({ expandedItemIds: [] }), fixed);
        expect(
            mounted.engine.check("scroll-to", { itemId: "app" }),
        ).toMatchObject({
            ok: false,
            error: { code: "refused" },
        });
    });

    it("End focuses the last item, which was outside the window (DOM focus included)", async () => {
        mounted = mountVirtual(flatModel(5000), fixed);
        mounted.engine.run("focus", { itemId: "n0" });
        expect(document.activeElement).toBe(mounted.item("n0"));
        expect(mounted.key("End")).toBe(true);
        await wait(0);
        expect(mounted.model.state.focusedItemId).toBe("n4999");
        expect(document.activeElement).toBe(mounted.item("n4999"));
        expect(mounted.root.scrollTop).toBe(5000 * ROW - 200);
        // Home goes back
        mounted.key("Home");
        expect(document.activeElement).toBe(mounted.item("n0"));
        expect(mounted.root.scrollTop).toBe(0);
    });

    it("PageDown and PageUp move a view's worth of rows; without a virtualizer they are not used", () => {
        mounted = mountVirtual(flatModel(1000), fixed);
        mounted.engine.run("focus", { itemId: "n0" });
        expect(mounted.key("PageDown")).toBe(true);
        expect(mounted.model.state.focusedItemId).toBe("n9");
        mounted.key("PageDown");
        mounted.key("PageDown");
        expect(mounted.model.state.focusedItemId).toBe("n27");
        expect(document.activeElement).toBe(mounted.item("n27"));
        mounted.key("PageUp");
        expect(mounted.model.state.focusedItemId).toBe("n18");
        mounted.unmount();
        mounted = undefined;
        const plain = createTreeEngine(flatModel(30));
        plain.run("focus", { itemId: "n0" });
        const event = new KeyboardEvent("keydown", { key: "PageDown" });
        expect(plain.adapter.handleKeyDown(event)).toBe(false);
        plain.destroy();
    });

    it("leaves an app's own binding of PageDown alone in a tree that is not virtualized", () => {
        const model = flatModel(30);
        const plain = createTreeEngine(model, {
            keyMap: { select: ["Enter", "PageDown"] },
        });
        plain.run("focus", { itemId: "n3" });
        const event = new KeyboardEvent("keydown", { key: "PageDown" });
        expect(plain.adapter.handleKeyDown(event)).toBe(true);
        expect(model.state.selectedItemIds).toEqual(["n3"]);
        plain.destroy();
    });

    it("type-ahead focuses a match outside the window", () => {
        mounted = mountVirtual(
            flatModel(3000, (i) => (i === 2500 ? "zeta" : `item ${i}`)),
            fixed,
        );
        mounted.engine.run("focus", { itemId: "n0" });
        mounted.key("z");
        expect(mounted.model.state.focusedItemId).toBe("n2500");
        expect(document.activeElement).toBe(mounted.item("n2500"));
    });

    it("keeps the roving tab stop rendered when it scrolls away", () => {
        mounted = mountVirtual(flatModel(1000), fixed);
        mounted.engine.run("focus", { itemId: "n5" });
        mounted.scroll(15_000);
        expect(mounted.item("n5")?.tabIndex).toBe(0);
        expect(mounted.item("n5")?.isConnected).toBe(true);
    });

    it("follows a model change: an expansion adds rows, kept in order", () => {
        mounted = mountVirtual(filesModel({ expandedItemIds: [] }), fixed);
        expect(mounted.rendered()).toEqual(["src", "readme"]);
        mounted.model.run("item.expand", { itemId: "src" });
        expect(mounted.rendered()).toEqual([
            "src",
            "app",
            "lib",
            "utils",
            "readme",
        ]);
        expect(mounted.engine.get("virtual-window")?.totalSize).toBe(5 * ROW);
    });

    it("an estimate per row, measured rows replacing it, and the view kept when a row above it grows", () => {
        const observers: ((entries: ResizeObserverEntry[]) => void)[] = [];
        vi.stubGlobal(
            "ResizeObserver",
            class {
                constructor(
                    callback: (entries: ResizeObserverEntry[]) => void,
                ) {
                    observers.push(callback);
                }
                observe() {}
                unobserve() {}
                disconnect() {}
            },
        );
        mounted = mountVirtual(
            flatModel(1000),
            createTreeVirtualizer({ estimateRowSize: () => 20, overscan: 2 }),
        );
        expect(mounted.root.style.overflowAnchor).toBe("none");
        mounted.scroll(2000);
        const rows = observers.at(-1);
        expect(rows).toBeDefined();
        const entry = (itemId: string, blockSize: number) =>
            ({
                target: mounted?.item(itemId),
                borderBoxSize: [{ blockSize, inlineSize: 300 }],
            }) as unknown as ResizeObserverEntry;
        // n98 is above the view (it starts at 1960): the view moves down with it
        rows?.([entry("n98", 50), entry("n101", 30)]);
        const window = mounted.engine.get("virtual-window");
        expect(window?.totalSize).toBe(1000 * 20 + 30 + 10);
        expect(window?.rows.find((row) => row.itemId === "n98")?.size).toBe(50);
        expect(mounted.root.scrollTop).toBe(2030);
        // a hidden row (0) keeps its size
        rows?.([entry("n101", 0)]);
        expect(mounted.engine.get("virtual-window")?.totalSize).toBe(20_040);
        // fixed sizes are never measured, and leave the scroll element's style alone
        mounted.unmount();
        mounted = mountVirtual(flatModel(10), fixed);
        expect(mounted.root.style.overflowAnchor).toBe("");
    });

    it("a keyboard drag reaches a target outside the window, its line drawn there", () => {
        mounted = mountVirtual(flatModel(1000), fixed);
        mounted.engine.run("focus", { itemId: "n0" });
        expect(
            mounted.engine.run("start-keyboard-drag", { itemIds: ["n0"] }).ok,
        ).toBe(true);
        for (let i = 0; i < 400; i++) mounted.key("ArrowDown");
        const target = mounted.engine.get("drop-target");
        expect(target?.itemId).toBeDefined();
        expect(mounted.item(target?.itemId ?? "")).toBeDefined();
        expect(mounted.root.scrollTop).toBeGreaterThan(1000);
        const indicator = mounted.engine.get("drop-indicator");
        expect(indicator).not.toBeNull();
        // the line is in view, relative to the root's top with its scroll
        expect(indicator?.blockOffset).toBeGreaterThanOrEqual(
            mounted.root.scrollTop,
        );
        expect(indicator?.blockOffset).toBeLessThanOrEqual(
            mounted.root.scrollTop + 200,
        );
        mounted.key("Enter");
        const index = mounted.model.state.rootItemIds.indexOf("n0");
        expect(index).toBeGreaterThan(14);
    });

    it("a pointer drag auto-scrolls to a target outside the window, keeping the pressed row", async () => {
        mounted = mountVirtual(flatModel(1000), fixed, {
            autoScroll: { speed: 40 },
        });
        const content = mounted.content("n0") as HTMLElement;
        pointer(content, "pointerdown", 50, 10);
        pointer(content, "pointermove", 50, 30);
        expect(mounted.engine.is("dragging")).toBe(true);
        // near the bottom edge: the root scrolls, frame after frame
        pointer(content, "pointermove", 50, 195);
        await wait(400);
        expect(mounted.root.scrollTop).toBeGreaterThan(400);
        expect(mounted.content("n0")?.isConnected).toBe(true);
        pointer(content, "pointermove", 50, 100);
        const target = mounted.engine.get("drop-target");
        expect(target).not.toBeNull();
        pointer(content, "pointerup", 50, 100);
        expect(mounted.model.state.rootItemIds.indexOf("n0")).toBeGreaterThan(
            20,
        );
    });

    it("takes a foreign drop on a row of its window, scrolled", () => {
        const dropped: unknown[] = [];
        mounted = mountVirtual(flatModel(1000), fixed, {
            foreignDrop: createTreeForeignDrop({
                onDrop: ({ to }) => dropped.push(to),
            }),
        });
        mounted.scroll(1000);
        const transfer = dataTransfer(["Files"]);
        expect(nativeDrag(mounted.root, "dragover", 50, 5, transfer)).toBe(
            true,
        );
        // between n49 and n50, in the window of the scrolled rows
        expect(mounted.engine.get("drop-target")).toMatchObject({
            parentItemId: null,
            index: 50,
        });
        nativeDrag(mounted.root, "drop", 50, 5, transfer);
        expect(dropped).toEqual([
            expect.objectContaining({ parentItemId: null, index: 50 }),
        ]);
    });

    it("drags between a virtualized tree and another tree of its group, by pointer and keyboard", () => {
        mounted = mountVirtual(flatModel(1000), fixed, { dragGroup: "g" });
        const other = mount(filesModel(), { dragGroup: "g" }, document, 400);
        try {
            // a pointer drag from the virtualized tree into the other one
            const content = mounted.content("n0") as HTMLElement;
            pointer(content, "pointerdown", 50, 10);
            pointer(content, "pointermove", 50, 30);
            pointer(content, "pointermove", 440, other.rowY("readme", 0.9));
            expect(other.engine.get("drop-target")).toMatchObject({
                position: "after",
                itemId: "readme",
            });
            pointer(content, "pointerup", 440, other.rowY("readme", 0.9));
            expect(other.model.state.rootItemIds).toEqual([
                "src",
                "readme",
                "n0",
            ]);
            expect(mounted.model.state.rootItemIds[0]).toBe("n1");
            // a keyboard drag from the other tree, up into the virtualized one: its last
            // position, scrolled into view
            other.engine.run("focus", { itemId: "src" });
            expect(
                other.engine.run("start-keyboard-drag", { itemIds: ["readme"] })
                    .ok,
            ).toBe(true);
            for (
                let i = 0;
                i < 20 && mounted.engine.get("drop-target") === null;
                i++
            )
                other.key("ArrowUp");
            expect(mounted.engine.get("drop-target")).toMatchObject({
                position: "after",
                itemId: "n999",
            });
            expect(mounted.root.scrollTop).toBeGreaterThan(19_000);
            expect(mounted.engine.get("drop-indicator")).not.toBeNull();
            other.key("Enter");
            expect(mounted.model.state.rootItemIds.at(-1)).toBe("readme");
            expect(other.model.state.items.readme).toBeUndefined();
        } finally {
            other.unmount();
        }
    });
});
