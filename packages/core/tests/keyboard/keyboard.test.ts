// @vitest-environment jsdom
import { afterEach, describe, expect, it } from "vitest";
import { matchesKey, parseKey } from "../../src/keyboard/key-map";
import { type Mounted, mount, wait } from "../engine/dom";
import { allFeatures, filesModel } from "../fixture";

let mounted: Mounted | undefined;
afterEach(() => {
    mounted?.unmount();
    mounted = undefined;
});

function setup(...args: Parameters<typeof filesModel>) {
    mounted = mount(filesModel(...args));
    return mounted;
}

const focused = (m: Mounted) => m.model.state.focusedItemId;
const active = () => document.activeElement?.getAttribute("data-item-id");

describe("the APG keyboard: moving", () => {
    it("Down and Up move over the visible items, DOM focus included; Home and End go to the ends", () => {
        const m = setup();
        m.engine.run("focus", { itemId: "src" });
        expect(active()).toBe("src");
        expect(m.key("ArrowDown")).toBe(true);
        expect(focused(m)).toBe("app");
        expect(active()).toBe("app");
        m.key("ArrowDown");
        m.key("ArrowDown");
        m.key("ArrowDown");
        expect(focused(m)).toBe("readme");
        // at the end: nothing to go to, the key is not used
        expect(m.key("ArrowDown")).toBe(false);
        m.key("ArrowUp");
        expect(focused(m)).toBe("utils");
        m.key("Home");
        expect(focused(m)).toBe("src");
        m.key("End");
        expect(focused(m)).toBe("readme");
    });

    it("leaves the keys of a control inside an item to the control", () => {
        const m = setup();
        const button = document.createElement("button");
        m.content("app").append(button);
        button.focus();
        const event = new KeyboardEvent("keydown", {
            key: "Enter",
            bubbles: true,
            cancelable: true,
        });
        button.dispatchEvent(event);
        expect(event.defaultPrevented).toBe(false);
        expect(m.model.state.selectedItemIds).toEqual([]);
        // the item itself still takes them
        m.item("app").focus();
        expect(m.key("Enter")).toBe(true);
        expect(m.model.state.selectedItemIds).toEqual(["app"]);
    });

    it("a disabled item is focusable", () => {
        const m = setup();
        m.model.run("item.set-flags", { itemId: "app", disabled: true });
        m.engine.run("focus", { itemId: "src" });
        m.key("ArrowDown");
        expect(focused(m)).toBe("app");
        // but not actionable
        expect(m.key("Enter")).toBe(false);
    });

    it("Right expands a collapsed parent, then moves to its first child; on a leaf it does nothing", () => {
        const m = setup();
        m.engine.run("focus", { itemId: "utils" });
        m.key("ArrowRight");
        expect(m.model.is("item-expanded", { itemId: "utils" })).toBe(true);
        expect(focused(m)).toBe("utils");
        m.key("ArrowRight");
        expect(focused(m)).toBe("a");
        expect(m.key("ArrowRight")).toBe(false);
    });

    it("Left collapses an expanded parent, then moves to the parent", () => {
        const m = setup({ expandedItemIds: ["src", "utils"] });
        m.engine.run("focus", { itemId: "a" });
        m.key("ArrowLeft");
        expect(focused(m)).toBe("utils");
        m.key("ArrowLeft");
        expect(m.model.is("item-expanded", { itemId: "utils" })).toBe(false);
        m.key("ArrowLeft");
        expect(focused(m)).toBe("src");
        m.key("ArrowLeft");
        expect(m.model.is("item-expanded", { itemId: "src" })).toBe(false);
        // a root item, collapsed: nowhere to go
        expect(m.key("ArrowLeft")).toBe(false);
    });

    it("Right and Left swap in a right-to-left tree", () => {
        const m = setup();
        m.root.setAttribute("dir", "rtl");
        expect(m.engine.get("direction")).toBe("rtl");
        m.engine.run("focus", { itemId: "utils" });
        m.key("ArrowLeft");
        expect(m.model.is("item-expanded", { itemId: "utils" })).toBe(true);
        m.key("ArrowLeft");
        expect(focused(m)).toBe("a");
        m.key("ArrowRight");
        expect(focused(m)).toBe("utils");
    });

    it("* expands the focused item's siblings", () => {
        const m = setup();
        m.engine.run("focus", { itemId: "app" });
        m.key("*", { shiftKey: true });
        expect(m.model.is("item-expanded", { itemId: "utils" })).toBe(true);
        expect(m.model.is("item-expanded", { itemId: "lib" })).toBe(true);
    });

    it("collapsing the item that holds DOM focus's item moves DOM focus to it", () => {
        const m = setup({ expandedItemIds: ["src", "utils"] });
        m.engine.run("focus", { itemId: "a" });
        m.model.run("item.collapse", { itemId: "src" });
        expect(active()).toBe("src");
    });
});

describe("the APG keyboard: selecting", () => {
    it("Enter selects; Space selects in single mode", () => {
        const m = setup();
        m.engine.run("focus", { itemId: "app" });
        m.key("Enter");
        expect(m.model.state.selectedItemIds).toEqual(["app"]);
        m.key("ArrowDown");
        m.key(" ");
        expect(m.model.state.selectedItemIds).toEqual(["lib"]);
    });

    it("Space toggles the checkbox when checkboxes are on", () => {
        mounted = mount(
            filesModel(
                {},
                { features: allFeatures({ checkboxes: { space: "check" } }) },
            ),
        );
        const m = mounted;
        m.engine.run("focus", { itemId: "utils" });
        m.key(" ");
        expect(m.model.get("check-state-by", { itemId: "utils" })).toBe(
            "checked",
        );
        expect(m.model.state.selectedItemIds).toEqual([]);
    });

    it("multiple mode: Space and Ctrl+Space toggle, Shift+Down and Shift+Up extend, Shift+Space extends to the focused item", () => {
        const m = setup({ settings: { selectionMode: "multiple" } });
        m.engine.run("focus", { itemId: "src" });
        m.key(" ");
        m.key("ArrowDown");
        m.key(" ", { ctrlKey: true });
        expect(m.model.state.selectedItemIds).toEqual(["src", "app"]);
        m.key(" ", { metaKey: true });
        expect(m.model.state.selectedItemIds).toEqual(["src"]);
        m.key("ArrowDown", { shiftKey: true });
        expect(focused(m)).toBe("lib");
        // from the anchor (app, the last toggled) to lib
        expect(m.model.state.selectedItemIds).toEqual(["app", "lib"]);
        m.key("ArrowDown", { shiftKey: true });
        expect(m.model.state.selectedItemIds).toEqual(["app", "lib", "utils"]);
        m.key("ArrowUp", { shiftKey: true });
        expect(m.model.state.selectedItemIds).toEqual(["app", "lib"]);
        m.key("End");
        m.key(" ", { shiftKey: true });
        expect(m.model.state.selectedItemIds).toEqual([
            "app",
            "lib",
            "utils",
            "readme",
        ]);
    });

    it("Ctrl+A selects all; Ctrl+Shift+Home and End extend to the ends", () => {
        const m = setup({ settings: { selectionMode: "multiple" } });
        m.engine.run("focus", { itemId: "lib" });
        m.key("a", { ctrlKey: true });
        expect(m.model.state.selectedItemIds).toHaveLength(5);
        m.key("Enter");
        m.key("Home", { ctrlKey: true, shiftKey: true });
        expect(focused(m)).toBe("src");
        expect(m.model.state.selectedItemIds).toEqual(["src", "app", "lib"]);
        m.key("End", { metaKey: true, shiftKey: true });
        expect(focused(m)).toBe("readme");
        expect(m.model.state.selectedItemIds).toEqual([
            "lib",
            "utils",
            "readme",
        ]);
    });

    it("F2 starts renaming; the app's editor keeps its own keys", () => {
        const m = setup();
        m.engine.run("focus", { itemId: "app" });
        m.key("F2");
        expect(m.model.is("item-renaming", { itemId: "app" })).toBe(true);
        const input = document.createElement("input");
        m.item("app").append(input);
        input.focus();
        expect(m.key("ArrowDown")).toBe(false);
        expect(
            m.engine.run("commit-rename", { itemId: "app", label: "main.ts" })
                .ok,
        ).toBe(true);
        expect(m.model.get("item-by", { id: "app" })?.label).toBe("main.ts");
        expect(active()).toBe("app");
    });
});

describe("type-ahead", () => {
    it("moves to the next visible item whose label starts with the typed text", async () => {
        mounted = mount(
            filesModel(
                {},
                { features: allFeatures({ typeAhead: { timeout: 30 } }) },
            ),
        );
        const m = mounted;
        m.engine.run("focus", { itemId: "src" });
        m.key("u");
        expect(focused(m)).toBe("utils");
        await wait(50);
        m.key("r");
        expect(focused(m)).toBe("readme");
        await wait(50);
        // a longer search refines, and may stay on the current item
        m.key("l");
        expect(focused(m)).toBe("lib");
        m.key("i");
        expect(focused(m)).toBe("lib");
        await wait(50);
        // nothing matches: the focus stays
        m.key("z");
        expect(focused(m)).toBe("lib");
    });

    it("typing the same character again cycles through its items", async () => {
        const model = filesModel(
            { expandedItemIds: ["src", "utils"] },
            { features: allFeatures({ typeAhead: { timeout: 30 } }) },
        );
        mounted = mount(model);
        const m = mounted;
        m.engine.run("focus", { itemId: "src" });
        m.key("a");
        expect(focused(m)).toBe("app");
        m.key("a");
        expect(focused(m)).toBe("a");
        m.key("a");
        expect(focused(m)).toBe("app");
    });
});

describe("the key map", () => {
    it("is overridable: an action given other keys, or none", () => {
        mounted = mount(filesModel(), {
            keyMap: { "focus-next": ["j"], "focus-previous": [] },
        });
        const m = mounted;
        m.engine.run("focus", { itemId: "src" });
        expect(m.key("ArrowDown")).toBe(false);
        m.key("j");
        expect(focused(m)).toBe("app");
        expect(m.key("ArrowUp")).toBe(false);
    });

    it("parses keys with modifiers; letters ignore case and symbols ignore Shift", () => {
        expect(parseKey("Control+Shift+d")).toEqual({
            key: "d",
            control: true,
            meta: false,
            alt: false,
            shift: true,
        });
        expect(parseKey("Control++").key).toBe("+");
        expect(parseKey(" ").key).toBe(" ");
        const event = {
            key: "D",
            shiftKey: true,
            ctrlKey: true,
            metaKey: false,
            altKey: false,
        };
        expect(matchesKey(event, "Control+Shift+d")).toBe(true);
        expect(matchesKey(event, "Control+d")).toBe(false);
        expect(
            matchesKey(
                {
                    key: "*",
                    shiftKey: true,
                    ctrlKey: false,
                    metaKey: false,
                    altKey: false,
                },
                "*",
            ),
        ).toBe(true);
        expect(() => parseKey("Hyper+a")).toThrow();
    });
});
