// @vitest-environment jsdom
import { afterEach, describe, expect, it } from "vitest";
import { createTreeEngine } from "../../src/engine/tree-engine";
import type { AnyTreeFeature } from "../../src/features/types";
import { selection } from "../../src/selection/selection";
import { createTreeModel } from "../../src/state/model";
import { virtualization } from "../../src/virtual/virtualization";
import { type Mounted, mount } from "../engine/dom";
import { files, filesModel } from "../fixture";

let mounted: Mounted<readonly []> | undefined;
afterEach(() => {
    mounted?.unmount();
    mounted = undefined;
});

const bare = () => filesModel({}, { features: [] });

describe("the feature registry", () => {
    it("lists the installed features, each with its root props", () => {
        expect(bare().get("features")).toEqual([]);
        const model = filesModel(
            {},
            { features: [selection(), virtualization()] },
        );
        const listed = model.get("features");
        expect(listed.map((feature) => feature.name)).toEqual([
            "selection",
            "virtualization",
        ]);
        expect(listed[0]?.rootProps.map((prop) => prop.prop)).toEqual([
            "selectedItemIds",
        ]);
        expect(Object.isFrozen(listed)).toBe(true);
    });

    it("refuses a feature installed twice, and a missing requirement, naming them", () => {
        expect(() =>
            createTreeModel(files(), { features: [selection(), selection()] }),
        ).toThrow("The selection feature is installed twice");
        const needy = {
            name: "virtualization",
            requires: ["selection"],
        } as unknown as AnyTreeFeature;
        expect(() => createTreeModel(files(), { features: [needy] })).toThrow(
            "Missing features: virtualization requires selection",
        );
        expect(() =>
            createTreeModel(files(), { features: [selection(), needy] }),
        ).not.toThrow();
    });

    it("answers a command of a feature that is not installed with not_found, never a throw", () => {
        const model = bare();
        const missing = {
            ok: false,
            error: {
                code: "not_found",
                message:
                    '"item.select" requires the selection feature (`@fragiola/tree/selection`)',
            },
        };
        // @ts-expect-error the selection feature is not installed
        expect(model.run("item.select", { itemId: "app" })).toEqual(missing);
        // @ts-expect-error the selection feature is not installed
        expect(model.can("item.select", { itemId: "app" })).toBe(false);
        expect(
            model.dispatch({
                command: "item.select",
                payload: { itemId: "app" },
            }),
        ).toEqual({
            ok: false,
            error: { ...missing.error, path: "/command" },
        });
        expect(
            model.run("batch", {
                commands: [
                    { command: "item.select", payload: { itemId: "app" } },
                ],
            }),
        ).toMatchObject({ ok: false, error: { code: "not_found" } });
        expect(
            model.dispatch({ command: "item.fly", payload: {} }),
        ).toMatchObject({ ok: false, error: { code: "unknown_command" } });
    });

    it("reads nothing for a key of a feature that is not installed", () => {
        const model = bare();
        // @ts-expect-error the selection feature is not installed
        expect(model.get("selected-items")).toBeUndefined();
        // @ts-expect-error the selection feature is not installed
        expect(model.is("item-selected", { itemId: "app" })).toBe(false);
    });

    it("lists only the installed features' commands", () => {
        const names = (features: readonly AnyTreeFeature[]) =>
            createTreeModel(files(), { features })
                .get("commands")
                .map((command) => command.name);
        expect(names([])).not.toContain("item.select");
        expect(names([selection()])).toEqual(
            expect.arrayContaining([
                "item.select",
                "tree.select",
                "tree.select-all",
                "tree.clear-selection",
            ]),
        );
    });

    it("refuses a feature's setting it does not have", () => {
        expect(
            bare().run("tree.configure", {
                settings: { selectionMode: "multiple" },
            }),
        ).toEqual({
            ok: false,
            error: {
                code: "invalid_payload",
                message:
                    "requires the selection feature (`@fragiola/tree/selection`)",
                path: "/settings/selectionMode",
            },
        });
        const model = filesModel();
        expect(
            model.run("tree.configure", {
                settings: { selectionMode: "multiple" },
            }).ok,
        ).toBe(true);
        expect(model.state.settings.selectionMode).toBe("multiple");
    });

    it("loads a document with a feature's fields only into a model with that feature", () => {
        const model = filesModel();
        model.run("item.select", { itemId: "app" });
        const json = model.get("tree-json");
        expect(json.selectedItemIds).toEqual(["app"]);
        expect(bare().run("tree.load", { json }).ok).toBe(false);
        const other = filesModel();
        expect(other.run("tree.load", { json }).ok).toBe(true);
        expect(other.state.selectedItemIds).toEqual(["app"]);
    });
});

describe("a bare tree (no feature)", () => {
    it("focuses and expands, but never selects: a click, Enter, Space or Ctrl+A", () => {
        const m = mount(bare());
        mounted = m;
        m.engine.adapter.handleClick("app", {
            shiftKey: false,
            ctrlKey: false,
            metaKey: false,
        });
        expect(m.model.state.focusedItemId).toBe("app");
        expect(m.key(" ")).toBe(false);
        expect(m.key("Enter")).toBe(false);
        expect(m.key("a", { ctrlKey: true })).toBe(false);
        expect(m.key("ArrowUp")).toBe(true);
        expect(m.model.state.focusedItemId).toBe("src");
        expect(m.key("ArrowLeft")).toBe(true);
        expect(m.model.is("item-expanded", { itemId: "src" })).toBe(false);
        expect("selectedItemIds" in m.model.state).toBe(false);
    });

    it("gives the items and the root no feature attribute", () => {
        const m = mount(bare());
        mounted = m;
        expect(m.engine.adapter.itemAttributes("app")).toEqual({});
        expect(m.engine.adapter.rootAttributes()).toEqual({});
    });

    it("drags the pressed item alone", () => {
        const m = mount(bare());
        mounted = m;
        m.item("app").focus();
        expect(m.key("d", { ctrlKey: true, shiftKey: true })).toBe(true);
        expect(m.engine.get("dragging-item-ids")).toEqual(["app"]);
        m.key("Escape");
    });
});

describe("engine contributions", () => {
    it("gives each engine on a model its own part (two virtualized views)", () => {
        const model = filesModel(
            {},
            { features: [virtualization({ rowSize: 20 })] },
        );
        const first = createTreeEngine(model);
        const second = createTreeEngine(model);
        const a = first.get("virtual-window");
        const b = second.get("virtual-window");
        expect(a).toBeDefined();
        expect(b).toBeDefined();
        first.destroy();
        // the second still has its own after the first is gone
        expect(second.get("virtual-window")).toEqual(b);
        second.destroy();
    });

    it("answers an engine action of a feature that is not installed with not_found", () => {
        const engine = createTreeEngine(bare());
        // @ts-expect-error the virtualization feature is not installed
        expect(engine.get("virtual-window")).toBeUndefined();
        expect(
            (engine.run as (action: string) => unknown)("fly"),
        ).toMatchObject({ ok: false, error: { code: "unknown_command" } });
        engine.destroy();
    });
});
