import { readFileSync } from "node:fs";
import { join } from "node:path";
import * as core from "@fragiola/tree";
import { describe, expect, it } from "vitest";
import { exportedNames } from "../../../scripts/exported-names.ts";
import * as asyncChildrenEntry from "../src/async-children";
import * as checkboxesEntry from "../src/checkboxes";
import * as react from "../src/index";
import * as renameEntry from "../src/rename";
import * as selectionEntry from "../src/selection";
import * as typeAheadEntry from "../src/type-ahead";
import * as virtualizationEntry from "../src/virtualization";

const read = (path: string) =>
    readFileSync(join(import.meta.dirname, "..", path), "utf-8");

/** The package's own runtime exports, and the primitives of the namespace: the documented API. */
const OWN = [
    "Tree",
    "createTreeRef",
    "useTree",
    "useTreeItem",
    "useTreeRef",
    "useTreeState",
];
const PRIMITIVES = [
    "DropIndicator",
    "Group",
    "Item",
    "ItemContent",
    "Items",
    "LiveRegion",
    "Root",
    "Toggle",
];

describe("@fragiola/tree-react", () => {
    it("re-exports the whole core", () => {
        expect(read("src/index.ts")).toMatch(
            /^export \* from "@fragiola\/tree";$/m,
        );
    });

    it("exports every runtime export of the core, identical", () => {
        const exported = new Map(Object.entries(react));
        const runtime = Object.entries(core);
        expect(runtime.length).toBeGreaterThan(0);
        for (const [name, value] of runtime) {
            expect(exported.get(name), name).toBe(value);
        }
    });

    it("exports exactly the documented runtime API besides the core", () => {
        const own = Object.keys(react).filter((name) => !(name in core));
        expect(own.sort()).toEqual([...OWN].sort());
        expect(Object.keys(react.Tree).sort()).toEqual(PRIMITIVES);
    });

    it("declares no name of its own that the core exports", () => {
        // a local export silently wins over `export *`: it would hide the core's
        const coreNames = new Set([
            ...exportedNames(read("../core/src/index.ts")),
            ...Object.keys(core),
        ]);
        const own = exportedNames(read("src/index.ts"));
        expect(own).toContain("Tree");
        expect(own.filter((name) => coreNames.has(name))).toEqual([]);
    });

    it("writes no `any` in its sources' public types", () => {
        const files = [
            "src/index.ts",
            "src/parts.ts",
            "src/context.ts",
            ...[
                "drop-indicator",
                "group",
                "item",
                "item-content",
                "items",
                "live-region",
                "root",
                "toggle",
            ].map((name) => `src/components/${name}.tsx`),
            ...[
                "create-tree-ref",
                "internal",
                "use-tree",
                "use-tree-item",
                "use-tree-ref",
                "use-tree-state",
            ].map((name) => `src/hooks/${name}.ts`),
            "src/rename/use-tree-item-rename.ts",
            "src/utils/use-render.ts",
            "src/utils/merge-props.ts",
            "src/utils/engine-facade.ts",
        ];
        for (const file of files) {
            expect(read(file), file).not.toMatch(/:\s*any\b|<any>|as any\b/);
        }
    });

    it("ships no CSS, no icons and no text", () => {
        const manifest = JSON.parse(read("package.json")) as {
            dependencies: Record<string, string>;
            files: string[];
        };
        expect(Object.keys(manifest.dependencies)).toEqual(["@fragiola/tree"]);
        expect(manifest.files).toEqual([
            "dist",
            "README.md",
            "CHANGELOG.md",
            "LICENSE",
        ]);
    });

    it("ships each feature from its own entry: the core's, and what renders it", () => {
        expect(Object.keys(selectionEntry).sort()).toEqual(["selection"]);
        expect(Object.keys(checkboxesEntry).sort()).toEqual(["checkboxes"]);
        expect(Object.keys(renameEntry).sort()).toEqual([
            "rename",
            "useTreeItemRename",
        ]);
        expect(Object.keys(asyncChildrenEntry).sort()).toEqual([
            "asyncChildren",
        ]);
        expect(Object.keys(typeAheadEntry).sort()).toEqual(["typeAhead"]);
        expect(Object.keys(virtualizationEntry).sort()).toEqual([
            "VirtualItems",
            "useTreeVirtualWindow",
            "virtualization",
        ]);
        for (const name of [
            "VirtualItems",
            "useTreeVirtualWindow",
            "useTreeItemRename",
        ])
            expect(name in react).toBe(false);
    });
});
