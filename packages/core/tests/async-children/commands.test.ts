import { describe, expect, it } from "vitest";
import { filesModel, visibleIds } from "../fixture";

describe("async children", () => {
    it("goes loading, then loaded with the children the loader returned", () => {
        const model = filesModel();
        model.run("item.expand", { itemId: "lib" });
        model.run("item.set-children-status", {
            itemId: "lib",
            status: "loading",
        });
        expect(model.is("item-loading", { itemId: "lib" })).toBe(true);
        expect(model.get("children-status-by", { itemId: "lib" })).toBe(
            "loading",
        );
        expect(
            model.run("item.set-children", {
                itemId: "lib",
                items: [
                    { kind: "file", label: "x.ts", data: { size: 1 } },
                    {
                        id: "deep",
                        kind: "folder",
                        label: "deep",
                        childrenStatus: "unloaded",
                    },
                ],
            }),
        ).toEqual({
            ok: true,
            value: { itemId: "lib", childItemIds: ["item-1", "deep"] },
        });
        expect(model.get("children-status-by", { itemId: "lib" })).toBe(
            "loaded",
        );
        expect(visibleIds(model)).toEqual([
            "src",
            "app",
            "lib",
            "item-1",
            "deep",
            "utils",
            "readme",
        ]);
    });

    it("goes error, and a reload resets it", () => {
        const model = filesModel();
        model.run("item.set-children-status", {
            itemId: "lib",
            status: "error",
        });
        expect(model.get("children-status-by", { itemId: "lib" })).toBe(
            "error",
        );
        model.run("item.set-children", {
            itemId: "lib",
            items: [{ id: "x", kind: "file", label: "x", data: { size: 1 } }],
        });
        model.run("item.expand", { itemId: "lib" });
        model.run("item.select", { itemId: "x" });
        expect(model.run("item.reset-children", { itemId: "lib" })).toEqual({
            ok: true,
            value: { itemId: "lib", removedItemIds: ["x"] },
        });
        expect(model.get("children-status-by", { itemId: "lib" })).toBe(
            "unloaded",
        );
        expect(model.get("item-by", { id: "x" })).toBeUndefined();
        expect(model.state.selectedItemIds).toEqual([]);
    });

    it("new children replace the old ones", () => {
        const model = filesModel();
        model.run("item.set-children", {
            itemId: "lib",
            items: [{ id: "x", kind: "file", label: "x", data: { size: 1 } }],
        });
        model.run("item.set-children", {
            itemId: "lib",
            items: [{ id: "x", kind: "file", label: "x2", data: { size: 2 } }],
        });
        expect(model.get("child-items-by", { itemId: "lib" })).toEqual([
            { id: "x", kind: "file", label: "x2", data: { size: 2 } },
        ]);
    });

    it("refuses an item that holds its children itself, taken ids and nested children", () => {
        const model = filesModel();
        expect(
            model.check("item.set-children", { itemId: "utils", items: [] }),
        ).toMatchObject({
            ok: false,
            error: { code: "refused", path: "/itemId" },
        });
        expect(
            model.check("item.set-children-status", {
                itemId: "app",
                status: "loading",
            }),
        ).toMatchObject({ ok: false, error: { code: "refused" } });
        expect(
            model.check("item.set-children", {
                itemId: "lib",
                items: [
                    { id: "app", kind: "file", label: "x", data: { size: 1 } },
                ],
            }),
        ).toMatchObject({
            ok: false,
            error: { code: "refused", path: "/items/0/id" },
        });
        expect(
            model.check("item.set-children", {
                itemId: "lib",
                items: [
                    { id: "x", kind: "file", label: "x", data: { size: 1 } },
                    { id: "x", kind: "file", label: "x", data: { size: 1 } },
                ],
            }),
        ).toMatchObject({ ok: false, error: { path: "/items/1/id" } });
        expect(
            model.check("item.set-children", {
                itemId: "lib",
                items: [
                    {
                        id: "x",
                        kind: "folder",
                        label: "x",
                        childItemIds: ["y"],
                    },
                ],
            }),
        ).toMatchObject({
            ok: false,
            error: { path: "/items/0/childItemIds" },
        });
        expect(
            model.check("item.reset-children", { itemId: "nope" }),
        ).toMatchObject({
            ok: false,
            error: { code: "not_found" },
        });
    });

    it("validates the children's data against their kind's schema", () => {
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
        expect(
            model.check("item.set-children", {
                itemId: "lib",
                items: [
                    {
                        kind: "file",
                        label: "x",
                        data: { size: "big" } as never,
                    },
                ],
            }),
        ).toMatchObject({
            ok: false,
            error: { code: "invalid_payload", path: "/items/0/data/size" },
        });
    });
});
