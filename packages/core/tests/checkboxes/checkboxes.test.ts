// @vitest-environment jsdom
import { afterEach, describe, expect, it } from "vitest";
import { checkboxes } from "../../src/checkboxes/checkboxes";
import type { FeatureModel } from "../../src/features/types";
import { selection } from "../../src/selection/selection";
import { type Mounted, mount } from "../engine/dom";
import { allFeatures, filesModel } from "../fixture";

let mounted: Mounted | undefined;
afterEach(() => {
    mounted?.unmount();
    mounted = undefined;
});

const loose = (model: object) => model as unknown as FeatureModel;

describe("the checkboxes feature", () => {
    it("is a frozen feature whose mode is the document's default", () => {
        const feature = checkboxes({ mode: "independent" });
        expect(Object.isFrozen(feature)).toBe(true);
        const model = filesModel({}, { features: [feature] });
        expect(model.state.settings.checkMode).toBe("independent");
        expect(model.state.checkedItemIds).toEqual([]);
    });

    it("gives every item aria-checked, data-checked and data-indeterminate, from the model", () => {
        const model = filesModel(
            { expandedItemIds: ["src", "utils"], checkedItemIds: ["a"] },
            { features: [checkboxes()] },
        );
        const attributes = (itemId: string) =>
            model.get("item-attributes-by", { itemId });
        expect(attributes("a")).toEqual({
            "aria-checked": "true",
            "data-checked": "",
        });
        expect(attributes("utils")).toEqual({
            "aria-checked": "mixed",
            "data-indeterminate": "",
        });
        expect(attributes("app")).toEqual({ "aria-checked": "false" });
    });

    it("without it: no check, no aria-checked, its commands and keys not found", () => {
        const model = filesModel({}, { features: [] });
        expect(model.get("item-attributes-by", { itemId: "app" })).toEqual({});
        expect(
            loose(model).run("item.check", { itemId: "app", checked: true }),
        ).toMatchObject({ ok: false, error: { code: "not_found" } });
        expect(
            loose(model).get("check-state-by", { itemId: "app" }),
        ).toBeUndefined();
        expect(loose(model).is("item-checked", { itemId: "app" })).toBe(false);
        expect("checkedItemIds" in model.state).toBe(false);
        expect(
            model
                .get("features")
                .flatMap((feature) => feature.rootProps)
                .map((rootProp) => rootProp.prop),
        ).toEqual([]);
    });

    it("Space checks when the selection is not installed, and selects when it is", () => {
        mounted = mount(filesModel({}, { features: [checkboxes()] }));
        mounted.engine.run("focus", { itemId: "app" });
        mounted.key(" ");
        expect(mounted.model.state.checkedItemIds).toEqual(["app"]);
        mounted.unmount();

        const both = filesModel({}, { features: [selection(), checkboxes()] });
        mounted = mount(both);
        mounted.engine.run("focus", { itemId: "app" });
        mounted.key(" ");
        expect(both.state.selectedItemIds).toEqual(["app"]);
        expect(both.state.checkedItemIds).toEqual([]);
    });

    it('Space checks with `space: "check"`, whatever the order of the features', () => {
        const model = filesModel(
            {},
            {
                features: [checkboxes({ space: "check" }), selection()],
            },
        );
        mounted = mount(model);
        mounted.engine.run("focus", { itemId: "app" });
        mounted.key(" ");
        expect(model.state.checkedItemIds).toEqual(["app"]);
        expect(model.state.selectedItemIds).toEqual([]);
    });

    it('`space: "select"` leaves Space alone without the selection', () => {
        const model = filesModel(
            {},
            { features: [checkboxes({ space: "select" })] },
        );
        mounted = mount(model);
        mounted.engine.run("focus", { itemId: "app" });
        mounted.key(" ");
        expect(model.state.checkedItemIds).toEqual([]);
    });

    it("ships the checkedItemIds root prop: it reads and syncs the checks", () => {
        const model = filesModel(
            { expandedItemIds: ["src", "utils"] },
            { features: allFeatures() },
        );
        const rootProp = model
            .get("features")
            .flatMap((feature) => feature.rootProps)
            .find((prop) => prop.prop === "checkedItemIds");
        expect(rootProp?.changeProp).toBe("onCheckedItemIdsChange");
        rootProp?.sync(loose(model), ["a", "b"], {});
        expect(model.get("check-state-by", { itemId: "utils" })).toBe(
            "checked",
        );
        expect(rootProp?.read(loose(model).state)).toEqual(
            model.state.checkedItemIds,
        );
    });

    it("syncing a list that drops a checked parent keeps the children it still lists", () => {
        const model = filesModel(
            { checkedItemIds: ["utils"] },
            { features: allFeatures() },
        );
        const rootProp = model
            .get("features")
            .flatMap((feature) => feature.rootProps)
            .find((prop) => prop.prop === "checkedItemIds");
        expect([...model.state.checkedItemIds].sort()).toEqual([
            "a",
            "b",
            "utils",
        ]);
        rootProp?.sync(loose(model), ["a"], {});
        expect(model.state.checkedItemIds).toEqual(["a"]);
        expect(model.get("check-state-by", { itemId: "utils" })).toBe("mixed");
    });

    it("keeps the cascade when items are added, moved or removed", () => {
        const model = filesModel(
            { expandedItemIds: ["src", "utils"], checkedItemIds: ["utils"] },
            { features: [checkboxes()] },
        );
        model.run("item.add", {
            item: { id: "c", kind: "file", label: "c.ts", data: { size: 4 } },
            to: { parentItemId: "utils" },
        });
        // a new child of a checked parent is checked
        expect(model.is("item-checked", { itemId: "c" })).toBe(true);
        model.run("item.check", { itemId: "a", checked: false });
        expect(model.get("check-state-by", { itemId: "utils" })).toBe("mixed");
        model.run("item.remove", { itemIds: ["a"] });
        expect(model.get("check-state-by", { itemId: "utils" })).toBe(
            "checked",
        );
    });
});
