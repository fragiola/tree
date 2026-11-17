// @vitest-environment jsdom
import { afterEach, describe, expect, it } from "vitest";
import type { CommandEvent } from "../../src/commands/types";
import { veto } from "../../src/commands/types";
import type { DragAndDropOptions } from "../../src/drag-and-drop/drag-and-drop";
import type { AnnounceEvent } from "../../src/engine/host";
import { type Mounted, mount, pointer, ROW, wait } from "../engine/dom";
import { allFeatures, type FileTypes, filesModel } from "../fixture";

let mounted: Mounted | undefined;
afterEach(() => {
    mounted?.unmount();
    mounted = undefined;
});

function setup(
    patch: Parameters<typeof filesModel>[0] = {},
    options: Parameters<typeof mount>[1] = {},
    dragAndDrop: DragAndDropOptions = {},
) {
    mounted = mount(
        filesModel(patch, {
            features: allFeatures({
                dragAndDrop: { autoExpandDelay: 20, ...dragAndDrop },
            }),
        }),
        options,
    );
    const events: CommandEvent<FileTypes>[] = [];
    mounted.model.subscribe((event) => events.push(event));
    return { m: mounted, events };
}

/** Presses `itemId`'s row and moves past the threshold. */
function startDrag(m: Mounted, itemId: string) {
    const content = m.content(itemId);
    const y = m.rowY(itemId);
    pointer(content, "pointerdown", 40, y);
    pointer(content, "pointermove", 40, y + 10);
}

describe("a pointer drag", () => {
    it("under the threshold, a press stays a click", () => {
        const { m, events } = setup();
        const content = m.content("app");
        pointer(content, "pointerdown", 40, m.rowY("app"));
        pointer(content, "pointermove", 41, m.rowY("app") + 1);
        expect(m.engine.is("dragging")).toBe(false);
        pointer(content, "pointerup", 41, m.rowY("app") + 1);
        content.click();
        expect(m.model.state.selectedItemIds).toEqual(["app"]);
        expect(m.model.state.focusedItemId).toBe("app");
        expect(events.map((event) => event.command)).toEqual([
            "item.focus",
            "item.select",
        ]);
    });

    it("hovers, auto-expands a collapsed parent, and drops: one committed item.move", async () => {
        const { m, events } = setup();
        startDrag(m, "readme");
        expect(m.engine.is("dragging")).toBe(true);
        expect(m.engine.get("dragging-item-ids")).toEqual(["readme"]);
        expect(m.engine.is("item-dragging", { itemId: "readme" })).toBe(true);
        // the middle of utils (collapsed): inside it
        pointer(m.content("readme"), "pointermove", 40, m.rowY("utils", 0.5));
        expect(m.engine.get("drop-target")).toEqual({
            parentItemId: "utils",
            index: 2,
            position: "inside",
            itemId: "utils",
            level: 3,
        });
        expect(m.engine.is("item-drop-target", { itemId: "utils" })).toBe(true);
        expect(m.engine.get("drop-indicator")).toMatchObject({
            position: "inside",
            blockOffset: 3 * ROW,
            blockSize: ROW,
            inlineOffset: 2 * 16,
        });
        await wait(40);
        // it expanded: a transient step
        expect(m.model.is("item-expanded", { itemId: "utils" })).toBe(true);
        // now the top of a.ts, inside utils
        pointer(m.content("readme"), "pointermove", 40, m.rowY("a", 0.1));
        expect(m.engine.get("drop-target")).toMatchObject({
            parentItemId: "utils",
            index: 0,
            position: "before",
            itemId: "a",
        });
        pointer(m.content("readme"), "pointerup", 40, m.rowY("a", 0.1));
        expect(m.engine.is("dragging")).toBe(false);
        expect(m.model.state.items.utils?.childItemIds).toEqual([
            "readme",
            "a",
            "b",
        ]);
        const committed = events.filter((event) => !event.transient);
        expect(committed.map((event) => event.command)).toEqual(["item.move"]);
        expect(
            events
                .filter((event) => event.transient)
                .map((event) => event.command),
        ).toEqual(["item.expand"]);
        // the click its release causes is not a click
        m.content("readme").click();
        expect(m.model.state.selectedItemIds).toEqual([]);
    });

    it("drags the selection when the pressed item is selected", () => {
        const { m } = setup({
            settings: { selectionMode: "multiple" },
            selectedItemIds: ["app", "readme"],
        });
        startDrag(m, "readme");
        expect(m.engine.get("dragging-item-ids")).toEqual(["app", "readme"]);
        pointer(m.content("readme"), "pointermove", 40, m.rowY("src", 0.1));
        pointer(m.content("readme"), "pointerup", 40, m.rowY("src", 0.1));
        expect(m.model.state.rootItemIds).toEqual(["app", "readme", "src"]);
    });

    it("the inline offset picks the level at the end of a sublist", () => {
        const { m } = setup({ expandedItemIds: ["src", "utils"] });
        startDrag(m, "readme");
        // the bottom of b.ts (the last of utils, itself the last of src), at the root's indentation
        pointer(m.content("readme"), "pointermove", 4, m.rowY("b", 0.9));
        expect(m.engine.get("drop-target")).toMatchObject({
            parentItemId: null,
            position: "after",
            itemId: "src",
            level: 1,
        });
        pointer(m.content("readme"), "pointermove", 20, m.rowY("b", 0.9));
        expect(m.engine.get("drop-target")).toMatchObject({
            parentItemId: "src",
            position: "after",
            itemId: "utils",
            level: 2,
        });
        pointer(m.content("readme"), "pointermove", 200, m.rowY("b", 0.9));
        expect(m.engine.get("drop-target")).toMatchObject({
            parentItemId: "utils",
            position: "after",
            itemId: "b",
            level: 3,
        });
    });

    it("a target the model refuses shows nothing: a middleware veto, a descendant", () => {
        const { m } = setup({ expandedItemIds: ["src", "utils"] });
        m.model.use((ctx, next) =>
            ctx.command === "item.move" &&
            ctx.payload.to.parentItemId === "utils"
                ? veto("not into utils")
                : next(),
        );
        startDrag(m, "readme");
        pointer(m.content("readme"), "pointermove", 200, m.rowY("a", 0.1));
        expect(m.engine.get("drop-target")).toBeNull();
        expect(m.engine.get("drop-indicator")).toBeNull();
        expect(m.engine.is("item-drop-target", { itemId: "a" })).toBe(false);
        pointer(m.content("readme"), "pointerup", 200, m.rowY("a", 0.1));
        expect(m.model.state.rootItemIds).toEqual(["src", "readme"]);

        // a folder dragged over its own descendant
        startDrag(m, "src");
        pointer(m.content("src"), "pointermove", 200, m.rowY("app", 0.5));
        expect(m.engine.get("drop-target")).toBeNull();
        m.engine.run("cancel-drag");
    });

    it("Escape, a cancelled pointer and a lost capture end it with nothing committed", () => {
        const { m, events } = setup();
        startDrag(m, "readme");
        pointer(m.content("readme"), "pointermove", 40, m.rowY("src", 0.1));
        document.dispatchEvent(new KeyboardEvent("keydown", { key: "Escape" }));
        expect(m.engine.is("dragging")).toBe(false);
        startDrag(m, "readme");
        pointer(m.content("readme"), "pointercancel", 40, 0);
        expect(m.engine.is("dragging")).toBe(false);
        startDrag(m, "readme");
        m.content("readme").dispatchEvent(new Event("lostpointercapture"));
        expect(m.engine.is("dragging")).toBe(false);
        expect(events).toEqual([]);
    });

    it("an item that cannot move does not drag, and a press on a toggle never does", () => {
        const { m } = setup();
        m.model.run("item.set-flags", { itemId: "readme", movable: false });
        startDrag(m, "readme");
        expect(m.engine.is("dragging")).toBe(false);
        const toggle = document.createElement("button");
        toggle.setAttribute("data-tree-part", "toggle");
        m.content("app").append(toggle);
        pointer(toggle, "pointerdown", 40, m.rowY("app"));
        pointer(m.content("app"), "pointermove", 40, m.rowY("app") + 30);
        expect(m.engine.is("dragging")).toBe(false);
    });

    it("announces each step through the app's announce", () => {
        const seen: AnnounceEvent["type"][] = [];
        const { m } = setup(
            {},
            {
                announce: (event) => {
                    seen.push(event.type);
                    return event.type === "drop"
                        ? `Moved ${event.itemIds.join(", ")}`
                        : undefined;
                },
            },
        );
        startDrag(m, "readme");
        pointer(m.content("readme"), "pointermove", 40, m.rowY("src", 0.1));
        pointer(m.content("readme"), "pointerup", 40, m.rowY("src", 0.1));
        expect(seen).toEqual(["drag-start", "drag-over", "drop"]);
        expect(m.engine.get("announcement")).toBe("Moved readme");
    });

    it("starts a drop line past its level by the indicatorInset option, not the inside box", () => {
        const { m } = setup({}, {}, { indicatorInset: 28 });
        startDrag(m, "readme");
        // the top of src: a line before it, at level 1
        pointer(m.content("readme"), "pointermove", 40, m.rowY("src", 0.1));
        expect(m.engine.get("drop-indicator")).toMatchObject({
            position: "before",
            level: 1,
            inlineOffset: 28,
        });
        // the middle of utils: inside it, with no inset (its child level)
        pointer(m.content("readme"), "pointermove", 40, m.rowY("utils", 0.5));
        expect(m.engine.get("drop-indicator")).toMatchObject({
            position: "inside",
            inlineOffset: 2 * 16,
        });
    });
});
