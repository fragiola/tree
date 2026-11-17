import { describe, expect, it } from "vitest";
import { filesModel, visibleIds } from "../fixture";

describe("expanding and collapsing", () => {
    it("expands and collapses a parent, which shows and hides its children", () => {
        const model = filesModel();
        expect(visibleIds(model)).toEqual([
            "src",
            "app",
            "lib",
            "utils",
            "readme",
        ]);
        expect(model.run("item.expand", { itemId: "utils" })).toEqual({
            ok: true,
            value: { itemId: "utils" },
        });
        expect(visibleIds(model)).toEqual([
            "src",
            "app",
            "lib",
            "utils",
            "a",
            "b",
            "readme",
        ]);
        model.run("item.collapse", { itemId: "src" });
        expect(visibleIds(model)).toEqual(["src", "readme"]);
        expect(model.is("item-expanded", { itemId: "utils" })).toBe(true);
    });

    it("toggles, and reports the new state", () => {
        const model = filesModel();
        expect(model.run("item.toggle", { itemId: "src" })).toEqual({
            ok: true,
            value: { itemId: "src", expanded: false },
        });
        expect(model.run("item.toggle", { itemId: "src" })).toEqual({
            ok: true,
            value: { itemId: "src", expanded: true },
        });
    });

    it("expands an unloaded parent at once (the engine loads it)", () => {
        const model = filesModel();
        expect(model.run("item.expand", { itemId: "lib" }).ok).toBe(true);
        expect(model.is("item-expanded", { itemId: "lib" })).toBe(true);
        expect(model.get("child-items-by", { itemId: "lib" })).toEqual([]);
    });

    it("refuses a leaf, a disabled item and a missing one", () => {
        const model = filesModel();
        expect(model.check("item.expand", { itemId: "app" })).toMatchObject({
            ok: false,
            error: { code: "refused", path: "/itemId" },
        });
        model.run("item.set-flags", { itemId: "utils", disabled: true });
        expect(model.check("item.toggle", { itemId: "utils" })).toMatchObject({
            ok: false,
            error: { code: "refused" },
        });
        expect(model.check("item.collapse", { itemId: "nope" })).toMatchObject({
            ok: false,
            error: { code: "not_found", path: "/itemId" },
        });
    });

    it("moves the focus to a collapsed item when it was inside it", () => {
        const model = filesModel({ expandedItemIds: ["src", "utils"] });
        model.run("item.focus", { itemId: "b" });
        model.run("item.collapse", { itemId: "utils" });
        expect(model.state.focusedItemId).toBe("utils");
        model.run("tree.collapse-all", {});
        expect(model.state.focusedItemId).toBe("src");
    });

    it("expands an item's siblings that are parents and not disabled (the * key)", () => {
        const model = filesModel();
        model.run("item.set-flags", { itemId: "lib", disabled: true });
        expect(model.run("item.expand-siblings", { itemId: "app" })).toEqual({
            ok: true,
            value: { expandedItemIds: ["utils"] },
        });
        expect(model.run("item.expand-siblings", { itemId: "src" })).toEqual({
            ok: true,
            value: { expandedItemIds: [] },
        });
    });

    it("expands every loaded parent, and collapses everything", () => {
        const model = filesModel();
        expect(model.run("tree.expand-all", {})).toEqual({
            ok: true,
            value: { expandedItemIds: ["utils"] },
        });
        expect(model.is("item-expanded", { itemId: "lib" })).toBe(false);
        expect(model.run("tree.collapse-all", {})).toEqual({
            ok: true,
            value: { collapsedItemIds: ["src", "utils"] },
        });
        expect(visibleIds(model)).toEqual(["src", "readme"]);
    });
});
