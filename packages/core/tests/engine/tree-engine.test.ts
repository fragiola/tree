// @vitest-environment jsdom
import { afterEach, describe, expect, it } from "vitest";
import { DRAG_EXEMPT, isDragExempt } from "../../src/dom/owner";
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

describe("renaming", () => {
    /** starts renaming an item and puts a plain input of the app's (no part attribute) in it, focused */
    function editing(m: Mounted, itemId: string): HTMLInputElement {
        m.engine.run("focus", { itemId });
        m.model.run("item.start-rename", { itemId });
        const input = document.createElement("input");
        m.content(itemId).append(input);
        input.focus();
        return input;
    }

    it("commit-rename renames and focuses the item; a refused label keeps it renaming", () => {
        mounted = mount(filesModel());
        const m = mounted;
        const input = editing(m, "app");
        expect(
            m.engine.run("commit-rename", { itemId: "app", label: "" }),
        ).toMatchObject({ ok: false, error: { code: "invalid_payload" } });
        expect(m.model.is("item-renaming", { itemId: "app" })).toBe(true);
        expect(document.activeElement).toBe(input);
        expect(
            m.engine.run("commit-rename", { itemId: "app", label: "main.ts" }),
        ).toEqual({ ok: true, value: { itemId: "app" } });
        expect(m.model.get("item-by", { id: "app" })?.label).toBe("main.ts");
        expect(m.model.state.renamingItemId).toBeNull();
        expect(document.activeElement).toBe(m.item("app"));
    });

    it("cancel-rename keeps the label and focuses the item", () => {
        mounted = mount(filesModel());
        const m = mounted;
        editing(m, "app");
        expect(m.engine.run("cancel-rename", { itemId: "app" })).toEqual({
            ok: true,
            value: { itemId: "app" },
        });
        expect(m.model.get("item-by", { id: "app" })?.label).toBe("app.ts");
        expect(document.activeElement).toBe(m.item("app"));
        expect(
            m.engine.check("cancel-rename", { itemId: "app" }),
        ).toMatchObject({ ok: false, error: { code: "refused" } });
    });

    it("focus: false leaves DOM focus where it went (a blur)", () => {
        mounted = mount(filesModel());
        const m = mounted;
        const input = editing(m, "app");
        const outside = document.createElement("button");
        document.body.append(outside);
        outside.focus();
        expect(
            m.engine.run("commit-rename", {
                itemId: "app",
                label: "main.ts",
                focus: false,
            }).ok,
        ).toBe(true);
        expect(document.activeElement).toBe(outside);
        input.remove();
        const again = editing(m, "lib");
        outside.focus();
        expect(
            m.engine.run("cancel-rename", { itemId: "lib", focus: false }).ok,
        ).toBe(true);
        expect(document.activeElement).toBe(outside);
        again.remove();
        outside.remove();
    });

    it("can and check answer without changing the model or focus", () => {
        mounted = mount(filesModel());
        const m = mounted;
        const input = editing(m, "app");
        expect(
            m.engine.can("commit-rename", { itemId: "app", label: "x.ts" }),
        ).toBe(true);
        expect(
            m.engine.can("commit-rename", { itemId: "app", label: "" }),
        ).toBe(false);
        expect(m.engine.can("cancel-rename", { itemId: "app" })).toBe(true);
        expect(m.model.get("item-by", { id: "app" })?.label).toBe("app.ts");
        expect(m.model.is("item-renaming", { itemId: "app" })).toBe(true);
        expect(document.activeElement).toBe(input);
        m.engine.destroy();
        expect(
            m.engine.run("commit-rename", { itemId: "app", label: "x.ts" }),
        ).toMatchObject({ ok: false, error: { code: "refused" } });
    });

    it("a command that ends the rename elsewhere takes focus from the app's editor back to the item", () => {
        mounted = mount(filesModel());
        const m = mounted;
        editing(m, "app");
        m.model.run("item.cancel-rename", { itemId: "app" });
        expect(document.activeElement).toBe(m.item("app"));
    });

    it("leaves focus in another control of an item outside a rename", () => {
        mounted = mount(filesModel());
        const m = mounted;
        m.engine.run("focus", { itemId: "app" });
        const button = document.createElement("button");
        m.content("app").append(button);
        button.focus();
        m.model.run("item.toggle-check", { itemId: "app" });
        // the test DOM re-appends every row on a change, which blurs the button: the point is that
        // the engine does not pull focus onto the item
        expect(document.activeElement).not.toBe(m.item("app"));
    });

    it("exempts an app's native controls and opt-outs from drags and keys, with no part attribute", () => {
        mounted = mount(filesModel());
        const m = mounted;
        const custom = document.createElement("span");
        custom.setAttribute("data-tree-no-drag", "");
        const button = document.createElement("button");
        const plain = document.createElement("span");
        m.content("app").append(custom, button, plain);
        expect(isDragExempt(custom, m.item("app"))).toBe(true);
        expect(isDragExempt(button, m.item("app"))).toBe(true);
        expect(isDragExempt(plain, m.item("app"))).toBe(false);
        expect(DRAG_EXEMPT).not.toContain("checkbox");
        expect(DRAG_EXEMPT).not.toContain("rename-input");
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
