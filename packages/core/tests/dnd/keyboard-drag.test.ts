// @vitest-environment jsdom
import { afterEach, describe, expect, it } from "vitest";
import type { CommandEvent } from "../../src/commands/types";
import { type Mounted, mount } from "../engine/dom";
import { type FileTypes, filesModel } from "../fixture";

let mounted: Mounted | undefined;
afterEach(() => {
    mounted?.unmount();
    mounted = undefined;
});

function setup() {
    mounted = mount(filesModel({ expandedItemIds: ["src", "utils"] }));
    const events: CommandEvent<FileTypes>[] = [];
    mounted.model.subscribe((event) => events.push(event));
    return { m: mounted, events };
}

const describeTarget = (m: Mounted) => {
    const target = m.engine.get("drop-target");
    return target && `${target.position} ${target.itemId}`;
};

describe("a keyboard drag", () => {
    it("starts with Ctrl+Shift+D, steps through every valid position, and drops with Enter", () => {
        const { m, events } = setup();
        m.engine.run("focus", { itemId: "readme" });
        events.length = 0;
        expect(m.key("d", { ctrlKey: true, shiftKey: true })).toBe(true);
        expect(m.engine.is("keyboard-dragging")).toBe(true);
        expect(m.engine.get("dragging-item-ids")).toEqual(["readme"]);
        // every position, from the top
        for (let i = 0; i < 20; i++) m.key("ArrowUp");
        const seen = [describeTarget(m)];
        for (let i = 0; i < 20; i++) {
            m.key("ArrowDown");
            const here = describeTarget(m);
            if (here !== seen.at(-1)) seen.push(here);
        }
        expect(seen).toEqual([
            "before src",
            "inside src",
            "before app",
            "after app",
            "after lib",
            "inside utils",
            "before a",
            "after a",
            "after b",
            "after utils",
            "before readme",
            "after readme",
        ]);
        // every one of them is a move the model accepts
        for (let i = 0; i < 20; i++) m.key("ArrowUp");
        for (let i = 0; i < 6; i++) m.key("ArrowDown");
        expect(describeTarget(m)).toBe("before a");
        m.key("Enter");
        expect(m.engine.is("dragging")).toBe(false);
        expect(m.model.state.items.utils?.childItemIds).toEqual([
            "readme",
            "a",
            "b",
        ]);
        expect(events.map((event) => event.command)).toEqual(["item.move"]);
    });

    it("Escape restores the original state, with no command committed", () => {
        const { m, events } = setup();
        const before = m.model.state;
        expect(
            m.engine.run("start-keyboard-drag", { itemIds: ["app"] }).ok,
        ).toBe(true);
        m.key("ArrowDown");
        m.key("ArrowDown");
        m.key("Escape");
        expect(m.engine.is("dragging")).toBe(false);
        expect(m.model.state).toBe(before);
        expect(events).toEqual([]);
    });

    it("refuses items that cannot move, and a second drag", () => {
        const { m } = setup();
        m.model.run("item.set-flags", { itemId: "app", movable: false });
        expect(
            m.engine.check("start-keyboard-drag", { itemIds: ["app"] }),
        ).toMatchObject({
            ok: false,
            error: { code: "refused", path: "/itemIds/0" },
        });
        expect(
            m.engine.check("start-keyboard-drag", { itemIds: ["nope"] }),
        ).toMatchObject({
            ok: false,
            error: { code: "not_found" },
        });
        m.engine.run("start-keyboard-drag", { itemIds: ["readme"] });
        expect(
            m.engine.can("start-keyboard-drag", { itemIds: ["readme"] }),
        ).toBe(false);
        expect(m.engine.run("cancel-drag").ok).toBe(true);
        expect(m.engine.can("cancel-drag")).toBe(false);
    });
});
