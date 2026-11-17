// @vitest-environment jsdom
import { afterEach, describe, expect, it } from "vitest";
import { createTreeEngine } from "../../src/engine/tree-engine";
import { filesModel } from "../fixture";
import { type Mounted, mount } from "./dom";

let mounted: Mounted | undefined;
afterEach(() => {
    mounted?.unmount();
    mounted = undefined;
});

describe("the engine's surface", () => {
    it("is exactly the verbs, plus adapter, subscribe and destroy, each bound", () => {
        const engine = createTreeEngine(filesModel());
        expect(Object.keys(engine).sort()).toEqual(
            [
                "adapter",
                "can",
                "check",
                "destroy",
                "get",
                "is",
                "run",
                "subscribe",
            ].sort(),
        );
        const { get } = engine;
        expect(get("dragging-item-ids")).toEqual([]);
        expect(Object.isFrozen(engine)).toBe(true);
        engine.destroy();
    });

    it("answers an unknown action without throwing", () => {
        const engine = createTreeEngine(filesModel());
        const run = engine.run as (action: string) => unknown;
        expect(run("fly")).toMatchObject({
            ok: false,
            error: { code: "unknown_command" },
        });
        engine.destroy();
        expect(engine.run("cancel-drag")).toMatchObject({
            ok: false,
            error: { code: "refused" },
        });
    });
});

describe("focus and scrolling", () => {
    it("focus moves DOM focus and the roving tab stop; refused for a hidden item", () => {
        mounted = mount(filesModel());
        const m = mounted;
        expect(m.engine.run("focus", { itemId: "utils" })).toEqual({
            ok: true,
            value: { itemId: "utils" },
        });
        expect(document.activeElement).toBe(m.item("utils"));
        expect(m.item("utils").tabIndex).toBe(0);
        expect(m.item("src").tabIndex).toBe(-1);
        expect(m.engine.check("focus", { itemId: "a" })).toMatchObject({
            ok: false,
            error: { code: "refused" },
        });
        // a dry run moves nothing
        m.engine.can("focus", { itemId: "src" });
        expect(document.activeElement).toBe(m.item("utils"));
    });

    it("DOM focus landing on an item makes it the focused item", () => {
        mounted = mount(filesModel());
        mounted.item("readme").focus();
        expect(mounted.model.state.focusedItemId).toBe("readme");
    });

    it("gives focus to the focused item's new element, registered before its old one goes", () => {
        mounted = mount(filesModel());
        const m = mounted;
        const old = m.item("readme");
        old.focus();
        // what Vue does when an item moves to another parent: the new element is attached
        // before the old one is removed
        const next = document.createElement("div");
        next.tabIndex = -1;
        m.root.append(next);
        m.model.run("item.move", {
            itemIds: ["readme"],
            to: { parentItemId: "src", index: 0 },
        });
        m.engine.adapter.registerItem("readme", next);
        expect(document.activeElement).toBe(next);
        // a new element of an item that is not focused takes nothing
        const other = document.createElement("div");
        other.tabIndex = -1;
        m.root.append(other);
        m.engine.adapter.registerItem("app", other);
        expect(document.activeElement).toBe(next);
    });

    it("scroll-to scrolls a rendered item into view", () => {
        mounted = mount(filesModel());
        const calls: unknown[] = [];
        mounted.item("app").scrollIntoView = (options) => calls.push(options);
        expect(mounted.engine.run("scroll-to", { itemId: "app" }).ok).toBe(
            true,
        );
        expect(calls).toEqual([{ block: "nearest", inline: "nearest" }]);
        expect(
            mounted.engine.check("scroll-to", { itemId: "a" }),
        ).toMatchObject({
            ok: false,
            error: { code: "refused" },
        });
        expect(
            mounted.engine.check("scroll-to", { itemId: "nope" }),
        ).toMatchObject({
            ok: false,
            error: { code: "not_found" },
        });
    });
});

describe("clicks", () => {
    it("select, Shift extends, Ctrl toggles; expandOnClick toggles a parent", () => {
        mounted = mount(
            filesModel({ settings: { selectionMode: "multiple" } }),
            {
                expandOnClick: true,
            },
        );
        const m = mounted;
        m.engine.adapter.handleClick("app", {
            shiftKey: false,
            ctrlKey: false,
            metaKey: false,
        });
        m.engine.adapter.handleClick("utils", {
            shiftKey: true,
            ctrlKey: false,
            metaKey: false,
        });
        expect(m.model.state.selectedItemIds).toEqual(["app", "lib", "utils"]);
        expect(m.model.is("item-expanded", { itemId: "utils" })).toBe(true);
        m.engine.adapter.handleClick("lib", {
            shiftKey: false,
            ctrlKey: true,
            metaKey: false,
        });
        expect(m.model.state.selectedItemIds).toEqual(["app", "utils"]);
        m.engine.adapter.handleToggleClick("utils");
        expect(m.model.is("item-expanded", { itemId: "utils" })).toBe(false);
        m.engine.adapter.handleCheckboxClick("utils");
        expect(m.model.get("check-state-by", { itemId: "utils" })).toBe(
            "checked",
        );
    });
});

describe("the DOM it reaches", () => {
    it("works inside an iframe: its document, its window", () => {
        const frame = document.createElement("iframe");
        document.body.append(frame);
        const inner = frame.contentDocument;
        if (!inner) throw new Error("no iframe document");
        mounted = mount(filesModel(), {}, inner);
        mounted.engine.run("focus", { itemId: "app" });
        expect(inner.activeElement).toBe(mounted.item("app"));
        expect(mounted.key("ArrowDown")).toBe(true);
        expect(mounted.model.state.focusedItemId).toBe("lib");
        mounted.unmount();
        mounted = undefined;
        frame.remove();
    });

    it("destroy releases everything: no re-render, no key", () => {
        mounted = mount(filesModel());
        const m = mounted;
        let renders = 0;
        m.engine.adapter.subscribe(() => {
            renders += 1;
        });
        m.engine.destroy();
        m.model.run("item.collapse", { itemId: "src" });
        expect(renders).toBe(0);
        expect(
            m.engine.adapter.handleKeyDown(
                new KeyboardEvent("keydown", { key: "ArrowDown" }),
            ),
        ).toBe(false);
    });
});
