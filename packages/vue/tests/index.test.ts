import { readFileSync } from "node:fs";
import { join } from "node:path";
import * as core from "@fragiola/tree";
import { describe, expect, it } from "vitest";
import { exportedNames } from "../../../scripts/exported-names.ts";
import * as vue from "../src/index";

const read = (path: string) =>
    readFileSync(join(import.meta.dirname, "..", path), "utf-8");

/** The package's own runtime exports, and the primitives of the namespace: the documented API. */
const OWN = [
    "Tree",
    "createTreeRef",
    "typedTree",
    "useTree",
    "useTreeItem",
    "useTreeItemRename",
    "useTreeRef",
    "useTreeState",
    "useTreeVirtualWindow",
];
/** The same primitives as @fragiola/tree-react's, in files of the same names. */
const PRIMITIVES = [
    "DropIndicator",
    "Group",
    "Item",
    "ItemContent",
    "Items",
    "LiveRegion",
    "Root",
    "Toggle",
    "VirtualItems",
];
const FILES = [
    "drop-indicator",
    "group",
    "item",
    "item-content",
    "items",
    "live-region",
    "root",
    "toggle",
];

describe("@fragiola/tree-vue", () => {
    it("re-exports the whole core", () => {
        expect(read("src/index.ts")).toMatch(
            /^export \* from "@fragiola\/tree";$/m,
        );
    });

    it("exports every runtime export of the core, identical", () => {
        const exported = new Map(Object.entries(vue));
        const runtime = Object.entries(core);
        expect(runtime.length).toBeGreaterThan(0);
        for (const [name, value] of runtime) {
            expect(exported.get(name), name).toBe(value);
        }
    });

    it("exports exactly the documented runtime API besides the core", () => {
        const own = Object.keys(vue).filter((name) => !(name in core));
        expect(own.sort()).toEqual([...OWN].sort());
        expect(Object.keys(vue.Tree).sort()).toEqual(PRIMITIVES);
        expect(vue.typedTree()).toBe(vue.Tree);
    });

    it("has a file per primitive, named as in the React adapter", () => {
        const react = (name: string) =>
            readFileSync(
                join(
                    import.meta.dirname,
                    "../../react/src/components",
                    `${name}.tsx`,
                ),
                "utf-8",
            );
        for (const name of FILES) {
            expect(read(`src/components/${name}.ts`), name).toBeTruthy();
            expect(react(name), name).toBeTruthy();
        }
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
            "src/typed.ts",
            "src/context.ts",
            ...FILES.map((name) => `src/components/${name}.ts`),
            ...[
                "create-tree-ref",
                "internal",
                "use-tree",
                "use-tree-item",
                "use-tree-item-rename",
                "use-tree-ref",
                "use-tree-state",
            ].map((name) => `src/composables/${name}.ts`),
            "src/utils/render.ts",
            "src/utils/primitive.ts",
            "src/utils/registration.ts",
            "src/utils/engine-facade.ts",
        ];
        for (const file of files) {
            expect(read(file), file).not.toMatch(/:\s*any\b|<any>|as any\b/);
        }
    });

    it("ships no CSS, no icons and no text", () => {
        const manifest = JSON.parse(read("package.json")) as {
            dependencies: Record<string, string>;
            peerDependencies: Record<string, string>;
            files: string[];
        };
        expect(Object.keys(manifest.dependencies)).toEqual(["@fragiola/tree"]);
        expect(manifest.peerDependencies).toEqual({ vue: "^3.5.0" });
        expect(manifest.files).toEqual([
            "dist",
            "README.md",
            "CHANGELOG.md",
            "LICENSE",
        ]);
    });
});
