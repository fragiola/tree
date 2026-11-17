import { describe, expect, it } from "vitest";
import { TreeValidationError, validateTree } from "../../src/state/load";
import { createTreeModel } from "../../src/state/model";
import { DEFAULT_SETTINGS } from "../../src/state/types";
import { allFeatures, bareFiles, files, filesModel } from "../fixture";

const features = allFeatures();

/** The issues of a document that should not load (with every feature), as `path: message`. */
function issues(json: unknown, withFeatures = true): string[] {
    return validateTree(json, withFeatures ? { features } : {}).map(
        (issue) => `${issue.path}: ${issue.message}`,
    );
}

describe("loading a document", () => {
    it("loads in plain Node, with no DOM", () => {
        expect(typeof globalThis.document).toBe("undefined");
        const model = filesModel();
        expect(model.state.rootItemIds).toEqual(["src", "readme"]);
        expect(model.state.items.app).toEqual({
            id: "app",
            kind: "file",
            label: "app.ts",
            data: { size: 120 },
        });
    });

    it("fills in the defaults", () => {
        const model = filesModel();
        expect(model.state.settings).toEqual({
            ...DEFAULT_SETTINGS,
            selectionMode: "single",
            checkMode: "cascade",
            renamable: true,
        });
        expect(model.state.selectedItemIds).toEqual([]);
        expect(filesModel({}, { features: [] }).state.settings).toEqual(
            DEFAULT_SETTINGS,
        );
        expect(model.state.focusedItemId).toBeNull();
        expect(model.state.renamingItemId).toBeNull();
        expect(createTreeModel().state.rootItemIds).toEqual([]);
    });

    it("freezes the state, and never the caller's document", () => {
        const json = bareFiles();
        const model = createTreeModel(json);
        expect(Object.isFrozen(model.state)).toBe(true);
        expect(Object.isFrozen(model.state.items.app)).toBe(true);
        expect(Object.isFrozen(model.state.items.app?.data)).toBe(true);
        expect(Object.isFrozen(json.items.app)).toBe(false);
        expect(Object.isFrozen(json.items.app?.data)).toBe(false);
    });

    it("writes the document back, and the round trip is stable", () => {
        const json = files({
            settings: { selectionMode: "multiple" },
            selectedItemIds: ["app", "readme"],
            checkedItemIds: ["utils"],
            focusedItemId: "app",
        });
        const first = createTreeModel(json, { features }).get("tree-json");
        const second = createTreeModel(first, { features }).get("tree-json");
        expect(second).toEqual(first);
        expect(first.settings).toEqual({
            ...DEFAULT_SETTINGS,
            selectionMode: "multiple",
            checkMode: "cascade",
            renamable: true,
        });
        expect(first.items.src).toEqual({
            id: "src",
            kind: "folder",
            label: "src",
            childItemIds: ["app", "lib", "utils"],
        });
        // a copy: changing it changes nothing in the model
        first.rootItemIds.push("x");
        expect(
            createTreeModel(json, { features }).get("tree-json").rootItemIds,
        ).toEqual(["src", "readme"]);
    });

    it("makes the cascade checks consistent: a checked parent checks its descendants, a parent follows its children", () => {
        const parent = filesModel({ checkedItemIds: ["utils"] });
        expect([...parent.state.checkedItemIds].sort()).toEqual([
            "a",
            "b",
            "utils",
        ]);
        const children = filesModel({ checkedItemIds: ["a", "b"] });
        expect(children.state.checkedItemIds).toContain("utils");
        const independent = filesModel({
            settings: { checkMode: "independent" },
            checkedItemIds: ["utils"],
        });
        expect(independent.state.checkedItemIds).toEqual(["utils"]);
    });

    it("drops an expanded leaf, and makes the focused item visible", () => {
        const model = filesModel({
            expandedItemIds: ["app", "src"],
            focusedItemId: "a",
        });
        expect(model.state.expandedItemIds).toEqual(["src"]);
        expect(model.state.focusedItemId).toBe("utils");
    });

    it("gives a loaded parent its list, and drops the children of one waiting for the loader", () => {
        const model = createTreeModel(
            {
                version: 1,
                rootItemIds: ["x", "y"],
                items: {
                    x: { kind: "folder", label: "x", childrenStatus: "loaded" },
                    y: {
                        kind: "folder",
                        label: "y",
                        childrenStatus: "error",
                        childItemIds: [],
                    },
                },
            },
            { features },
        );
        expect(model.state.items.x?.childItemIds).toEqual([]);
        expect(model.state.items.y?.childItemIds).toBeUndefined();
    });
});

describe("an invalid document", () => {
    it("throws a TreeValidationError with every issue and its JSON path", () => {
        let thrown: unknown;
        try {
            createTreeModel({
                version: 1,
                rootItemIds: ["a"],
                items: { a: { kind: "", label: "a" } },
            });
        } catch (error) {
            thrown = error;
        }
        expect(thrown).toBeInstanceOf(TreeValidationError);
        const error = thrown as TreeValidationError;
        expect(error.issues).toEqual([
            {
                path: "/items/a/kind",
                message: "must have at least 1 character(s)",
            },
        ]);
        expect(error.message).toContain("/items/a/kind");
    });

    it("reports the same issues through validateTree", () => {
        const json = { version: 2, rootItemIds: [], items: {} };
        expect(validateTree(json)).toEqual([
            { path: "/version", message: "must be 1" },
        ]);
        expect(() => createTreeModel(json as never)).toThrow(
            TreeValidationError,
        );
        expect(validateTree(bareFiles())).toEqual([]);
        expect(validateTree(files(), { features })).toEqual([]);
    });

    it("refuses unknown fields and wrong types", () => {
        expect(
            issues({
                version: 1,
                rootItemIds: ["a"],
                items: { a: { kind: "k", label: 3, extra: true } },
                expandedItemIds: ["a", "a"],
            }),
        ).toEqual([
            "/items/a/label: must be a string",
            "/items/a/extra: is not allowed",
            "/expandedItemIds: must not repeat an item",
        ]);
    });

    it("refuses references to missing items, items with two parents, orphans, cycles and a wrong id", () => {
        expect(
            issues({
                version: 1,
                rootItemIds: ["a", "ghost"],
                items: {
                    a: { kind: "k", label: "a", childItemIds: ["b", "c"] },
                    b: { kind: "k", label: "b", childItemIds: ["c"] },
                    c: { kind: "k", label: "c" },
                    orphan: { kind: "k", label: "o" },
                    x: { kind: "k", label: "x", childItemIds: ["y"] },
                    y: { id: "z", kind: "k", label: "y", childItemIds: ["x"] },
                },
                selectedItemIds: ["nope"],
                focusedItemId: "nope",
            }),
        ).toEqual([
            '/rootItemIds/1: "ghost" is not an item',
            '/items/b/childItemIds/0: "c" is already a child of "a"',
            '/items/y/id: must be "y", the item\'s key',
            "/items/orphan: is not in the tree: no parent and not a root item",
            "/items/x: is inside a cycle: it is not reachable from the root",
            "/items/y: is inside a cycle: it is not reachable from the root",
            '/focusedItemId: "nope" is not an item',
            // an installed feature's rules come after the core's
            '/selectedItemIds/0: "nope" is not an item',
        ]);
    });

    it("refuses children on a parent still waiting for the loader", () => {
        expect(
            issues({
                version: 1,
                rootItemIds: ["a", "b"],
                items: {
                    a: {
                        kind: "k",
                        label: "a",
                        childrenStatus: "unloaded",
                        childItemIds: ["b"],
                    },
                    b: { kind: "k", label: "b" },
                },
            }),
        ).toEqual([
            "/items/a/childItemIds: must be empty while the children are unloaded",
            '/items/a/childItemIds/0: "b" is already a child of the root',
        ]);
    });

    it("refuses the fields and settings of a feature that is not installed", () => {
        const json = files({
            settings: {
                selectionMode: "multiple",
                checkMode: "independent",
                renamable: false,
            },
            selectedItemIds: ["app"],
            selectionAnchorItemId: "app",
            checkedItemIds: ["app"],
            renamingItemId: "app",
            items: {
                ...files().items,
                readme: {
                    kind: "file",
                    label: "readme.md",
                    data: { size: 3 },
                    renamable: false,
                },
            },
        });
        expect(issues(json, false)).toEqual([
            "/selectedItemIds: requires the selection feature (`@fragiola/tree/selection`)",
            "/selectionAnchorItemId: requires the selection feature (`@fragiola/tree/selection`)",
            "/checkedItemIds: requires the checkboxes feature (`@fragiola/tree/checkboxes`)",
            "/renamingItemId: requires the rename feature (`@fragiola/tree/rename`)",
            "/items/lib/childrenStatus: requires the async-children feature (`@fragiola/tree/async-children`)",
            "/items/readme/renamable: requires the rename feature (`@fragiola/tree/rename`)",
            "/settings/selectionMode: requires the selection feature (`@fragiola/tree/selection`)",
            "/settings/checkMode: requires the checkboxes feature (`@fragiola/tree/checkboxes`)",
            "/settings/renamable: requires the rename feature (`@fragiola/tree/rename`)",
        ]);
        expect(() => createTreeModel(json)).toThrow(TreeValidationError);
        expect(issues(json)).toEqual([]);
    });

    it("writes only the installed features' fields", () => {
        const bare = createTreeModel(bareFiles()).get("tree-json");
        expect("selectedItemIds" in bare).toBe(false);
        expect("selectionAnchorItemId" in bare).toBe(false);
        expect("checkedItemIds" in bare).toBe(false);
        expect("renamingItemId" in bare).toBe(false);
        expect(bare.settings).toEqual(DEFAULT_SETTINGS);
    });

    it("refuses a selection the selection mode does not allow", () => {
        expect(issues(files({ selectedItemIds: ["app", "readme"] }))).toEqual([
            '/selectedItemIds: must hold at most one item when the selection mode is "single"',
        ]);
        expect(
            issues(
                files({
                    settings: { selectionMode: "none" },
                    selectedItemIds: ["app"],
                }),
            ),
        ).toEqual([
            '/selectedItemIds: must be empty when the selection mode is "none"',
        ]);
    });

    it("validates each item's data against its kind's schema", () => {
        const dataSchemas = {
            file: {
                type: "object",
                properties: { size: { type: "number" } },
                required: ["size"],
            },
        } as const;
        expect(
            validateTree(
                {
                    version: 1,
                    rootItemIds: ["a"],
                    items: { a: { kind: "file", label: "a", data: {} } },
                },
                { dataSchemas },
            ),
        ).toEqual([{ path: "/items/a/data/size", message: "is required" }]);
    });
});
