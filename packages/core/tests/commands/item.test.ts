import { describe, expect, it } from "vitest";
import { createTreeModel } from "../../src/state/model";
import { filesModel, visibleIds } from "../fixture";

describe("item.add", () => {
    it("adds an item at an index, or last, with a generated id", () => {
        const model = filesModel();
        expect(
            model.run("item.add", {
                item: { kind: "file", label: "new.ts", data: { size: 0 } },
                to: { parentItemId: "src", index: 1 },
            }),
        ).toEqual({ ok: true, value: { itemId: "item-1" } });
        expect(model.state.items.src?.childItemIds).toEqual([
            "app",
            "item-1",
            "lib",
            "utils",
        ]);
        model.run("item.add", {
            item: { id: "z", kind: "folder", label: "z", childItemIds: [] },
            to: { parentItemId: null },
        });
        expect(model.state.rootItemIds).toEqual(["src", "readme", "z"]);
        // an empty parent takes children
        expect(
            model.can("item.add", {
                item: { kind: "folder", label: "in z" },
                to: { parentItemId: "z" },
            }),
        ).toBe(true);
    });

    it("draws ids from the injected generator, never from a taken one", () => {
        let n = 0;
        const model = filesModel(
            {},
            { createId: () => (n++ === 0 ? "app" : `id-${n}`) },
        );
        expect(
            model.run("item.add", {
                item: { kind: "folder", label: "x" },
                to: { parentItemId: null },
            }),
        ).toEqual({ ok: true, value: { itemId: "id-2" } });
        // a dry run commits no id
        model.check("item.add", {
            item: { kind: "folder", label: "x" },
            to: { parentItemId: null },
        });
        expect(
            model.run("item.add", {
                item: { kind: "folder", label: "y" },
                to: { parentItemId: null },
            }),
        ).toMatchObject({ ok: true });
    });

    it("refuses a leaf, an unloaded parent, a missing parent and a taken id", () => {
        const model = filesModel();
        const add = (parentItemId: string | null, id?: string) =>
            model.check("item.add", {
                item: { ...(id ? { id } : {}), kind: "folder", label: "x" },
                to: { parentItemId },
            });
        expect(add("app")).toMatchObject({
            ok: false,
            error: { code: "refused", path: "/to/parentItemId" },
        });
        expect(add("lib")).toMatchObject({
            ok: false,
            error: { code: "refused" },
        });
        expect(add("nope")).toMatchObject({
            ok: false,
            error: { code: "not_found", path: "/to/parentItemId" },
        });
        expect(add(null, "readme")).toMatchObject({
            ok: false,
            error: { code: "refused", path: "/item/id" },
        });
    });
});

describe("item.remove", () => {
    it("removes subtrees, and every list forgets them", () => {
        const model = filesModel({
            settings: { selectionMode: "multiple" },
            expandedItemIds: ["src", "utils"],
            selectedItemIds: ["a", "readme"],
            checkedItemIds: ["b"],
        });
        expect(model.run("item.remove", { itemIds: ["utils", "a"] })).toEqual({
            ok: true,
            value: { removedItemIds: ["utils", "a", "b"] },
        });
        expect(model.state.items.a).toBeUndefined();
        expect(model.state.expandedItemIds).toEqual(["src"]);
        expect(model.state.selectedItemIds).toEqual(["readme"]);
        expect(model.state.checkedItemIds).toEqual([]);
        expect(model.check("item.remove", { itemIds: ["a"] })).toMatchObject({
            ok: false,
            error: { code: "not_found", path: "/itemIds/0" },
        });
    });

    it("moves the focus to the visible item now at its place", () => {
        const model = filesModel();
        model.run("item.focus", { itemId: "lib" });
        model.run("item.remove", { itemIds: ["lib"] });
        expect(model.state.focusedItemId).toBe("utils");
        model.run("item.focus", { itemId: "readme" });
        model.run("item.remove", { itemIds: ["readme"] });
        expect(model.state.focusedItemId).toBe("utils");
        model.run("item.remove", { itemIds: ["src"] });
        expect(model.state.focusedItemId).toBeNull();
    });
});

describe("item.move", () => {
    it("moves before the child at an index counted as the list is now", () => {
        const model = filesModel();
        model.run("item.move", {
            itemIds: ["app"],
            to: { parentItemId: "src", index: 3 },
        });
        expect(model.state.items.src?.childItemIds).toEqual([
            "lib",
            "utils",
            "app",
        ]);
        model.run("item.move", {
            itemIds: ["app"],
            to: { parentItemId: "src", index: 0 },
        });
        expect(model.state.items.src?.childItemIds).toEqual([
            "app",
            "lib",
            "utils",
        ]);
        // the index of the item itself: it stays
        model.run("item.move", {
            itemIds: ["lib"],
            to: { parentItemId: "src", index: 1 },
        });
        expect(model.state.items.src?.childItemIds).toEqual([
            "app",
            "lib",
            "utils",
        ]);
    });

    it("moves several items in tree order, an item inside another going with it", () => {
        const model = filesModel();
        expect(
            model.run("item.move", {
                itemIds: ["readme", "b", "utils", "app"],
                to: { parentItemId: null, index: 0 },
            }),
        ).toEqual({ ok: true, value: { itemIds: ["app", "utils", "readme"] } });
        expect(model.state.rootItemIds).toEqual([
            "app",
            "utils",
            "readme",
            "src",
        ]);
        expect(model.state.items.utils?.childItemIds).toEqual(["a", "b"]);
        expect(model.state.items.src?.childItemIds).toEqual(["lib"]);
    });

    it("refuses a cycle, a leaf, an unloaded or non-droppable or disabled parent, and a non-movable or disabled item", () => {
        const model = filesModel();
        const move = (itemIds: string[], parentItemId: string | null) =>
            model.check("item.move", {
                itemIds,
                to: { parentItemId, index: 0 },
            });
        expect(move(["src"], "utils")).toMatchObject({
            ok: false,
            error: { code: "refused", path: "/to/parentItemId" },
        });
        expect(move(["utils"], "utils")).toMatchObject({
            ok: false,
            error: { code: "refused" },
        });
        expect(move(["readme"], "app")).toMatchObject({
            ok: false,
            error: { code: "refused" },
        });
        expect(move(["readme"], "lib")).toMatchObject({
            ok: false,
            error: { code: "refused" },
        });
        model.run("item.set-flags", { itemId: "utils", droppable: false });
        expect(move(["readme"], "utils")).toMatchObject({
            ok: false,
            error: { code: "refused" },
        });
        model.run("item.set-flags", { itemId: "utils", droppable: null });
        expect(move(["readme"], "utils").ok).toBe(true);
        model.run("item.set-flags", { itemId: "readme", movable: false });
        expect(move(["app", "readme"], null)).toMatchObject({
            ok: false,
            error: { code: "refused", path: "/itemIds/1" },
        });
        model.run("item.set-flags", { itemId: "app", disabled: true });
        expect(move(["app"], null)).toMatchObject({
            ok: false,
            error: { code: "refused", path: "/itemIds/0" },
        });
        expect(move(["nope"], null)).toMatchObject({
            ok: false,
            error: { code: "not_found", path: "/itemIds/0" },
        });
    });

    it("model.can agrees with run", () => {
        const cases: [string[], string | null][] = [
            [["src"], "utils"],
            [["app"], "utils"],
            [["readme"], "lib"],
            [["a"], null],
            [["utils"], "src"],
        ];
        for (const [itemIds, parentItemId] of cases) {
            const model = filesModel();
            const payload = { itemIds, to: { parentItemId, index: 0 } };
            const can = model.can("item.move", payload);
            expect(
                model.run("item.move", payload).ok,
                JSON.stringify(payload),
            ).toBe(can);
        }
    });

    it("the focus moved into a collapsed parent goes to that parent", () => {
        const model = filesModel();
        model.run("item.focus", { itemId: "readme" });
        model.run("item.move", {
            itemIds: ["readme"],
            to: { parentItemId: "utils", index: 0 },
        });
        expect(model.state.focusedItemId).toBe("utils");
        expect(visibleIds(model)).toEqual(["src", "app", "lib", "utils"]);
    });
});

describe("an item's own fields", () => {
    it("replaces its data, validated by its kind's schema", () => {
        const model = filesModel(
            {},
            {
                dataSchemas: {
                    file: {
                        type: "object",
                        properties: { size: { type: "number" } },
                        required: ["size"],
                    },
                },
            },
        );
        model.run("item.set-data", { itemId: "app", data: { size: 7 } });
        expect(model.get("item-by", { id: "app" })?.data).toEqual({ size: 7 });
        expect(
            model.check("item.set-data", { itemId: "app", data: {} as never }),
        ).toMatchObject({
            ok: false,
            error: { code: "invalid_payload", path: "/data/size" },
        });
        model.run("item.set-data", { itemId: "src" });
        expect(model.get("item-by", { id: "src" })).not.toHaveProperty("data");
    });

    it("sets its flags, and null takes the default again", () => {
        const model = filesModel();
        model.run("item.set-flags", {
            itemId: "app",
            movable: false,
            disabled: true,
        });
        expect(model.get("item-by", { id: "app" })).toMatchObject({
            movable: false,
            disabled: true,
        });
        expect(model.is("item-disabled", { itemId: "app" })).toBe(true);
        model.run("item.set-flags", {
            itemId: "app",
            movable: null,
            disabled: null,
        });
        expect(model.get("item-by", { id: "app" })).toEqual({
            id: "app",
            kind: "file",
            label: "app.ts",
            data: { size: 120 },
        });
    });
});

describe("tree.load", () => {
    it("replaces the tree, keeping the identity of the items that did not change", () => {
        const model = filesModel();
        const before = model.state;
        const json = model.get("tree-json");
        json.items.readme = {
            ...json.items.readme,
            label: "README.md",
        } as never;
        model.run("tree.load", { json });
        expect(model.state.items.app).toBe(before.items.app);
        expect(model.state.items.readme).not.toBe(before.items.readme);
        expect(model.state.items.readme?.label).toBe("README.md");
    });

    it("reports a bad document's issues under /json", () => {
        const model = createTreeModel();
        expect(
            model.check("tree.load", {
                json: {
                    version: 1,
                    rootItemIds: ["x"],
                    items: {},
                },
            }),
        ).toMatchObject({
            ok: false,
            error: { code: "invalid_payload", path: "/json/rootItemIds/0" },
        });
    });
});
