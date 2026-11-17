// @vitest-environment jsdom
import { afterEach, describe, expect, it } from "vitest";
import type { FeatureModel } from "../../src/features/types";
import { rename } from "../../src/rename/rename";
import { type Mounted, mount } from "../engine/dom";
import { filesModel } from "../fixture";

let mounted: Mounted | undefined;
afterEach(() => {
    mounted?.unmount();
    mounted = undefined;
});

const loose = (model: object) => model as unknown as FeatureModel;

describe("the rename feature", () => {
    it("is a frozen feature whose renamable default is the document's default", () => {
        const feature = rename({ renamable: false });
        expect(Object.isFrozen(feature)).toBe(true);
        const model = filesModel({}, { features: [feature] });
        expect(model.state.settings.renamable).toBe(false);
        expect(model.is("item-renamable", { itemId: "app" })).toBe(false);
        expect(model.state.renamingItemId).toBeNull();
    });

    it("gives the renaming item data-renaming, from the model", () => {
        const model = filesModel({}, { features: [rename()] });
        model.run("item.start-rename", { itemId: "app" });
        expect(model.get("item-attributes-by", { itemId: "app" })).toEqual({
            "data-renaming": "",
        });
        expect(model.get("item-attributes-by", { itemId: "readme" })).toEqual(
            {},
        );
    });

    it("F2 starts renaming the focused item, and the engine's actions finish it", () => {
        mounted = mount(filesModel({}, { features: [rename()] }));
        mounted.engine.run("focus", { itemId: "app" });
        mounted.key("F2");
        expect(mounted.model.is("item-renaming", { itemId: "app" })).toBe(true);
        expect(
            mounted.engine.run("commit-rename", {
                itemId: "app",
                label: "main.ts",
            }),
        ).toEqual({ ok: true, value: { itemId: "app" } });
        expect(mounted.model.get("item-by", { id: "app" })?.label).toBe(
            "main.ts",
        );
    });

    it("without it: F2 does nothing, its commands, keys and actions are not found", () => {
        mounted = mount(filesModel({}, { features: [] }));
        const model = loose(mounted.model);
        mounted.engine.run("focus", { itemId: "app" });
        expect(mounted.key("F2")).toBe(false);
        expect(model.run("item.start-rename", { itemId: "app" })).toMatchObject(
            { ok: false, error: { code: "not_found" } },
        );
        expect(model.is("item-renaming", { itemId: "app" })).toBe(false);
        expect(model.is("item-renamable", { itemId: "app" })).toBe(false);
        const engine = mounted.engine as unknown as {
            check(key: string, payload: object): { ok: boolean };
        };
        expect(
            engine.check("commit-rename", { itemId: "app", label: "x" }),
        ).toMatchObject({ ok: false, error: { code: "not_found" } });
        expect("renamingItemId" in mounted.model.state).toBe(false);
    });

    it("refuses an item's renamable flag without it", () => {
        const model = loose(filesModel({}, { features: [] }));
        expect(
            model.run("item.set-flags", { itemId: "app", renamable: false }),
        ).toMatchObject({
            ok: false,
            error: { code: "invalid_payload", path: "/renamable" },
        });
        expect(
            model.run("item.add", {
                item: {
                    kind: "file",
                    label: "c",
                    data: { size: 1 },
                    renamable: true,
                },
                to: { parentItemId: null },
            }),
        ).toMatchObject({
            ok: false,
            error: { code: "invalid_payload", path: "/item/renamable" },
        });
        // with it, the flag stops the rename under way
        const renaming = filesModel({}, { features: [rename()] });
        renaming.run("item.start-rename", { itemId: "app" });
        renaming.run("item.set-flags", { itemId: "app", renamable: false });
        expect(renaming.state.renamingItemId).toBeNull();
    });
});
