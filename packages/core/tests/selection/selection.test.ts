// @vitest-environment jsdom
import { afterEach, describe, expect, it } from "vitest";
import { dragAndDrop } from "../../src/drag-and-drop/drag-and-drop";
import type { FeatureModel } from "../../src/features/types";
import { selection } from "../../src/selection/selection";
import { type Mounted, mount } from "../engine/dom";
import { filesModel } from "../fixture";

let mounted: Mounted | undefined;
afterEach(() => {
    mounted?.unmount();
    mounted = undefined;
});

describe("the selection feature", () => {
    it("is a frozen feature whose mode is the document's default", () => {
        const feature = selection({ mode: "multiple" });
        expect(Object.isFrozen(feature)).toBe(true);
        expect(feature.name).toBe("selection");
        const model = filesModel({}, { features: [feature] });
        expect(model.state.settings.selectionMode).toBe("multiple");
        // the document's own mode wins
        const single = filesModel(
            { settings: { selectionMode: "single" } },
            { features: [feature] },
        );
        expect(single.state.settings.selectionMode).toBe("single");
    });

    it("gives the items aria-selected and data-selected, and the root aria-multiselectable", () => {
        const m = mount(
            filesModel({}, { features: [selection({ mode: "multiple" })] }),
        );
        mounted = m;
        expect(m.model.get("item-attributes-by", { itemId: "app" })).toEqual({
            "aria-selected": "false",
        });
        m.model.run("item.select", { itemId: "app" });
        expect(m.model.get("item-attributes-by", { itemId: "app" })).toEqual({
            "aria-selected": "true",
            "data-selected": "",
        });
        expect(m.model.get("root-attributes")).toEqual({
            "aria-multiselectable": "true",
        });
        m.model.run("tree.configure", { settings: { selectionMode: "none" } });
        expect(m.model.get("item-attributes-by", { itemId: "app" })).toEqual(
            {},
        );
        expect(m.model.get("root-attributes")).toEqual({});
    });

    it("gives the attributes from the model's state alone: no engine, no screen", () => {
        const model = filesModel(
            {
                settings: { selectionMode: "multiple" },
                selectedItemIds: ["app"],
            },
            { features: [selection()] },
        );
        expect(model.get("item-attributes-by", { itemId: "app" })).toEqual({
            "aria-selected": "true",
            "data-selected": "",
        });
        expect(model.get("root-attributes")).toEqual({
            "aria-multiselectable": "true",
        });
    });

    it("selects on a click: Shift extends, Ctrl toggles", () => {
        const m = mount(
            filesModel({}, { features: [selection({ mode: "multiple" })] }),
        );
        mounted = m;
        const press = { shiftKey: false, ctrlKey: false, metaKey: false };
        m.engine.adapter.handleClick("app", press);
        m.engine.adapter.handleClick("utils", { ...press, shiftKey: true });
        expect(m.model.state.selectedItemIds).toEqual(["app", "lib", "utils"]);
        m.engine.adapter.handleClick("lib", { ...press, ctrlKey: true });
        expect(m.model.state.selectedItemIds).toEqual(["app", "utils"]);
    });

    it("ships the selectedItemIds root prop: it reads the list and brings the model to it", () => {
        const model = filesModel();
        const [prop] = selection().rootProps ?? [];
        expect(prop?.prop).toBe("selectedItemIds");
        expect(prop?.changeProp).toBe("onSelectedItemIdsChange");
        const feature = model as unknown as FeatureModel;
        prop?.sync(feature, ["readme", "ghost"], { meta: { source: "test" } });
        expect(model.state.selectedItemIds).toEqual(["readme"]);
        expect(prop?.read(feature.state)).toEqual(["readme"]);
        const before = model.state;
        prop?.sync(feature, ["readme"], {});
        expect(model.state).toBe(before);
    });

    it("forgets removed and disabled items, and a narrower mode trims the selection", () => {
        const model = filesModel(
            {
                settings: { selectionMode: "multiple" },
                selectedItemIds: ["app", "a", "readme"],
                selectionAnchorItemId: "a",
            },
            { features: [selection()] },
        );
        model.run("item.remove", { itemIds: ["utils"] });
        expect(model.state.selectedItemIds).toEqual(["app", "readme"]);
        expect(model.state.selectionAnchorItemId).toBeNull();
        model.run("item.set-flags", { itemId: "readme", disabled: true });
        expect(model.state.selectedItemIds).toEqual(["app"]);
        model.run("tree.select", { itemIds: ["app", "src"] });
        model.run("tree.configure", { settings: { selectionMode: "single" } });
        expect(model.state.selectedItemIds).toEqual(["app"]);
    });

    it("prefers the first visible selected item as the tab stop", () => {
        const model = filesModel({ selectedItemIds: ["readme"] });
        expect(model.get("tab-stop-item")?.id).toBe("readme");
        expect(filesModel({}, { features: [] }).get("tab-stop-item")?.id).toBe(
            "src",
        );
    });

    it("drags the selection when the pressed item is in it", () => {
        const m = mount(
            filesModel(
                {
                    settings: { selectionMode: "multiple" },
                    selectedItemIds: ["app", "readme"],
                },
                { features: [selection(), dragAndDrop()] },
            ),
        );
        mounted = m;
        m.item("app").focus();
        m.key("d", { ctrlKey: true, shiftKey: true });
        expect(m.engine.get("dragging-item-ids")).toEqual(["app", "readme"]);
        m.key("Escape");
    });
});
