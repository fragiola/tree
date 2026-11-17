import { describe, expect, it } from "vitest";
import { filesModel } from "../fixture";

describe("model.get", () => {
    it("visible-items: render order, with level, posinset and setsize", () => {
        const model = filesModel({ expandedItemIds: ["src", "utils"] });
        expect(model.get("visible-items")).toEqual([
            {
                itemId: "src",
                parentItemId: null,
                level: 1,
                posinset: 1,
                setsize: 2,
            },
            {
                itemId: "app",
                parentItemId: "src",
                level: 2,
                posinset: 1,
                setsize: 3,
            },
            {
                itemId: "lib",
                parentItemId: "src",
                level: 2,
                posinset: 2,
                setsize: 3,
            },
            {
                itemId: "utils",
                parentItemId: "src",
                level: 2,
                posinset: 3,
                setsize: 3,
            },
            {
                itemId: "a",
                parentItemId: "utils",
                level: 3,
                posinset: 1,
                setsize: 2,
            },
            {
                itemId: "b",
                parentItemId: "utils",
                level: 3,
                posinset: 2,
                setsize: 2,
            },
            {
                itemId: "readme",
                parentItemId: null,
                level: 1,
                posinset: 2,
                setsize: 2,
            },
        ]);
        // the same list while the state does not change
        expect(model.get("visible-items")).toBe(model.get("visible-items"));
    });

    it("an item, its parent, its children, the root items", () => {
        const model = filesModel();
        expect(model.get("item-by", { id: "a" })?.label).toBe("a.ts");
        expect(model.get("item-by", { id: "toString" })).toBeUndefined();
        expect(model.get("item-parent-by", { itemId: "a" })?.id).toBe("utils");
        expect(model.get("item-parent-by", { itemId: "src" })).toBeUndefined();
        expect(
            model.get("child-items-by", { itemId: "utils" }).map((i) => i.id),
        ).toEqual(["a", "b"]);
        expect(model.get("child-items-by", { itemId: "app" })).toEqual([]);
        expect(model.get("root-items").map((i) => i.id)).toEqual([
            "src",
            "readme",
        ]);
        expect(model.get("settings").selectionMode).toBe("single");
    });

    it("item-path-by: the index at each level, from the root", () => {
        const model = filesModel();
        expect(model.get("item-path-by", { itemId: "src" })).toBe("/0");
        expect(model.get("item-path-by", { itemId: "b" })).toBe("/0/2/1");
        expect(model.get("item-path-by", { itemId: "readme" })).toBe("/1");
        expect(model.get("item-path-by", { itemId: "nope" })).toBeUndefined();
    });

    it("type-ahead-match: the next visible label that starts with the text, wrapping, ignoring case", () => {
        const model = filesModel();
        const match = (text: string, fromItemId?: string) =>
            model.get("type-ahead-match", { text, fromItemId })?.id;
        expect(match("a")).toBe("app");
        expect(match("U")).toBe("utils");
        expect(match("a", "app")).toBe("app"); // wraps back to itself: the only match
        expect(match("r", "readme")).toBe("readme");
        expect(match("s", "readme")).toBe("src");
        expect(match("li")).toBe("lib");
        expect(match("b")).toBeUndefined(); // b.ts is hidden
        expect(match("")).toBeUndefined();
    });
});

describe("model.is", () => {
    it("answers each question", () => {
        const model = filesModel({
            settings: { selectionMode: "multiple" },
            selectedItemIds: ["app"],
            checkedItemIds: ["a"],
        });
        expect(model.is("item-expanded", { itemId: "src" })).toBe(true);
        expect(model.is("item-selected", { itemId: "app" })).toBe(true);
        expect(model.is("item-checked", { itemId: "a" })).toBe(true);
        expect(model.is("item-leaf", { itemId: "app" })).toBe(true);
        expect(model.is("item-leaf", { itemId: "lib" })).toBe(false);
        expect(model.is("item-visible", { itemId: "a" })).toBe(false);
        expect(model.is("item-visible", { itemId: "utils" })).toBe(true);
        expect(
            model.is("item-descendant-of", {
                itemId: "b",
                ancestorItemId: "src",
            }),
        ).toBe(true);
        expect(
            model.is("item-descendant-of", {
                itemId: "src",
                ancestorItemId: "src",
            }),
        ).toBe(false);
        expect(model.is("item-loading", { itemId: "lib" })).toBe(false);
    });
});
