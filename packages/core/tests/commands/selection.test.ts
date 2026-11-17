import { describe, expect, it } from "vitest";
import { filesModel } from "../fixture";

const multiple = { settings: { selectionMode: "multiple" as const } };

describe("selection", () => {
    it("replaces the selection with one item, and sets the anchor", () => {
        const model = filesModel(multiple);
        model.run("item.select", { itemId: "app" });
        expect(model.run("item.select", { itemId: "readme" })).toEqual({
            ok: true,
            value: { selectedItemIds: ["readme"] },
        });
        expect(model.state.selectionAnchorItemId).toBe("readme");
        expect(model.get("selected-items").map((item) => item.id)).toEqual([
            "readme",
        ]);
    });

    it("toggles one item in and out", () => {
        const model = filesModel(multiple);
        model.run("item.select", { itemId: "app" });
        model.run("item.select", { itemId: "readme", mode: "toggle" });
        expect(model.state.selectedItemIds).toEqual(["app", "readme"]);
        model.run("item.select", { itemId: "app", mode: "toggle" });
        expect(model.state.selectedItemIds).toEqual(["readme"]);
    });

    it("extends over the visible range from the anchor, skipping disabled items", () => {
        const model = filesModel({
            ...multiple,
            expandedItemIds: ["src", "utils"],
        });
        model.run("item.set-flags", { itemId: "lib", disabled: true });
        model.run("item.select", { itemId: "app" });
        expect(
            model.run("item.select", { itemId: "a", mode: "extend" }),
        ).toEqual({
            ok: true,
            value: { selectedItemIds: ["app", "utils", "a"] },
        });
        // the anchor stays: extending upwards from it
        expect(
            model.run("item.select", { itemId: "src", mode: "extend" }),
        ).toEqual({ ok: true, value: { selectedItemIds: ["src", "app"] } });
        expect(model.state.selectionAnchorItemId).toBe("app");
    });

    it("extends from the focused item when there is no anchor", () => {
        const model = filesModel(multiple);
        model.run("item.focus", { itemId: "utils" });
        expect(
            model.run("item.select", { itemId: "readme", mode: "extend" }),
        ).toEqual({
            ok: true,
            value: { selectedItemIds: ["utils", "readme"] },
        });
    });

    it("never holds two items in single mode", () => {
        const model = filesModel();
        model.run("item.select", { itemId: "app" });
        model.run("item.select", { itemId: "readme", mode: "toggle" });
        expect(model.state.selectedItemIds).toEqual(["readme"]);
        model.run("item.select", { itemId: "src", mode: "extend" });
        expect(model.state.selectedItemIds).toEqual(["src"]);
        expect(
            model.check("tree.select", { itemIds: ["app", "readme"] }),
        ).toMatchObject({
            ok: false,
            error: { code: "refused", path: "/itemIds" },
        });
        expect(model.can("tree.select-all", {})).toBe(false);
    });

    it("refuses everything in none mode, and disabled items in any mode", () => {
        const none = filesModel({ settings: { selectionMode: "none" } });
        expect(none.check("item.select", { itemId: "app" })).toMatchObject({
            ok: false,
            error: { code: "refused" },
        });
        const model = filesModel(multiple);
        model.run("item.set-flags", { itemId: "app", disabled: true });
        expect(model.can("item.select", { itemId: "app" })).toBe(false);
        expect(
            model.check("tree.select", { itemIds: ["readme", "app"] }),
        ).toMatchObject({ ok: false, error: { path: "/itemIds/1" } });
    });

    it("selects all the visible items, and clears", () => {
        const model = filesModel(multiple);
        expect(model.run("tree.select-all", {})).toEqual({
            ok: true,
            value: {
                selectedItemIds: ["src", "app", "lib", "utils", "readme"],
            },
        });
        model.run("tree.clear-selection", {});
        expect(model.state.selectedItemIds).toEqual([]);
        expect(model.state.selectionAnchorItemId).toBeNull();
    });

    it("trims the selection when the mode narrows", () => {
        const model = filesModel(multiple);
        model.run("tree.select", { itemIds: ["app", "readme"] });
        model.run("tree.configure", { settings: { selectionMode: "single" } });
        expect(model.state.selectedItemIds).toEqual(["app"]);
        model.run("tree.configure", { settings: { selectionMode: "none" } });
        expect(model.state.selectedItemIds).toEqual([]);
    });
});

describe("the focused item", () => {
    it("is the roving tab stop: focused, else the first selected visible, else the first visible", () => {
        const model = filesModel();
        expect(model.get("tab-stop-item")?.id).toBe("src");
        model.run("item.select", { itemId: "utils" });
        expect(model.get("tab-stop-item")?.id).toBe("utils");
        model.run("item.focus", { itemId: "readme" });
        expect(model.get("tab-stop-item")?.id).toBe("readme");
        expect(model.is("item-tab-stop", { itemId: "readme" })).toBe(true);
        expect(model.is("item-focused", { itemId: "readme" })).toBe(true);
    });

    it("can be a disabled item, never a hidden one", () => {
        const model = filesModel();
        model.run("item.set-flags", { itemId: "app", disabled: true });
        expect(model.run("item.focus", { itemId: "app" }).ok).toBe(true);
        expect(model.check("item.focus", { itemId: "a" })).toMatchObject({
            ok: false,
            error: { code: "refused" },
        });
    });
});
