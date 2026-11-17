import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import * as core from "@fragiola/tree";
import { describe, expect, it } from "vitest";
import { exportedNames } from "../../../scripts/exported-names.ts";
import * as angular from "../src/public-api";

const read = (path: string) =>
    readFileSync(join(import.meta.dirname, "..", path), "utf-8");

/** The React primitives' file names (`src/components/<name>.tsx`). */
const REACT_FILES = readdirSync(
    join(import.meta.dirname, "../../react/src/components"),
)
    .filter((file) => file.endsWith(".tsx"))
    .map((file) => file.slice(0, -".tsx".length))
    .sort();

/**
 * The React part hooks of a feature that are a directive of its entry here
 * (`react/src/rename/use-tree-item-rename.ts` → `rename/item-rename.directive.ts`): they wire an
 * element of the app's own, as an attribute directive does.
 */
const FEATURE_PART_HOOKS = [
    { entry: "rename", hook: "use-tree-item-rename" },
] as const;

/** Every directive's file name of the main entry (`src/lib/directives/<name>.directive.ts`). */
const DIRECTIVE_FILES = [...REACT_FILES].sort();

/** `item-content` → `TreeItemContentDirective`. */
const directiveOf = (file: string) =>
    `Tree${file
        .split("-")
        .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
        .join("")}Directive`;

/** The package's own runtime exports: the documented API. */
const OWN = [
    ...DIRECTIVE_FILES.map(directiveOf),
    "TREE",
    "injectTree",
    "injectTreeItem",
    "injectTreeState",
];

/** Every file of the package's sources. */
function sources(): string[] {
    const files: string[] = [];
    const walk = (folder: string) => {
        for (const entry of readdirSync(folder, { withFileTypes: true })) {
            const full = join(folder, entry.name);
            if (entry.isDirectory()) walk(full);
            else files.push(full);
        }
    };
    walk(join(import.meta.dirname, "..", "src"));
    return files;
}

describe("@fragiola/tree-angular", () => {
    it("re-exports the whole core", () => {
        expect(read("src/public-api.ts")).toMatch(
            /^export \* from "@fragiola\/tree";$/m,
        );
    });

    it("exports every runtime export of the core, identical", () => {
        const exported = new Map(Object.entries(angular));
        const runtime = Object.entries(core);
        expect(runtime.length).toBeGreaterThan(0);
        for (const [name, value] of runtime) {
            expect(exported.get(name), name).toBe(value);
        }
    });

    it("exports exactly the documented runtime API besides the core", () => {
        expect(REACT_FILES).toHaveLength(7);
        for (const { entry, hook } of FEATURE_PART_HOOKS) {
            expect(
                readdirSync(
                    join(import.meta.dirname, `../../react/src/${entry}`),
                ),
            ).toContain(`${hook}.ts`);
            const name = hook.slice("use-tree-".length);
            expect(read(`${entry}/${name}.directive.ts`), name).toContain(
                `export class ${directiveOf(name)}`,
            );
            expect(name in angular, name).toBe(false);
        }
        // `ɵ` names are what the feature entries build on, not an app's API
        const own = Object.keys(angular).filter(
            (name) => !(name in core) && !name.startsWith("ɵ"),
        );
        expect(own.sort()).toEqual([...OWN].sort());
    });

    it("lists every directive in TREE, once", () => {
        const directives = DIRECTIVE_FILES.map(
            (file) => (angular as Record<string, unknown>)[directiveOf(file)],
        );
        expect(new Set(angular.TREE)).toEqual(new Set(directives));
        expect(angular.TREE).toHaveLength(directives.length);
    });

    it("has a directive file per primitive and part hook, named as in the React adapter, and the templates' types", () => {
        const files = readdirSync(
            join(import.meta.dirname, "../src/lib/directives"),
        ).sort();
        expect(files).toEqual(
            [
                ...DIRECTIVE_FILES.map((name) => `${name}.directive.ts`),
                "templates.directive.ts",
            ].sort(),
        );
        for (const name of DIRECTIVE_FILES) {
            expect(
                read(`src/lib/directives/${name}.directive.ts`),
                name,
            ).toContain(`export class ${directiveOf(name)}`);
        }
    });

    it("declares no name of its own that the core exports", () => {
        // a local export silently wins over `export *`: it would hide the core's
        const coreNames = new Set([
            ...exportedNames(read("../core/src/index.ts")),
            ...Object.keys(core),
        ]);
        const own = exportedNames(read("src/public-api.ts"));
        expect(own).toContain("TreeRootDirective");
        expect(own.filter((name) => coreNames.has(name))).toEqual([]);
    });

    it("writes no `any` in its sources", () => {
        for (const file of sources()) {
            expect(readFileSync(file, "utf-8"), file).not.toMatch(
                /:\s*any\b|<any>|as any\b/,
            );
        }
    });

    it("imports nothing at runtime but @angular/core and the core, and depends on the core only", () => {
        const manifest = JSON.parse(read("package.json")) as {
            dependencies?: Record<string, string>;
            peerDependencies?: Record<string, string>;
        };
        expect(Object.keys(manifest.dependencies ?? {})).toEqual([
            "@fragiola/tree",
        ]);
        expect(Object.keys(manifest.peerDependencies ?? {})).toEqual([
            "@angular/core",
        ]);
        const IMPORT = /(?:from\s+|import\s*\(\s*)["']([^"'.][^"']*)["']/g;
        for (const file of sources()) {
            for (const [, specifier] of readFileSync(file, "utf-8").matchAll(
                IMPORT,
            )) {
                expect(["@angular/core", "@fragiola/tree"], file).toContain(
                    specifier,
                );
            }
        }
    });

    it("ships the virtualization from its own entry, out of TREE and the main entry", async () => {
        const entry = await import("../virtualization/public-api");
        expect(Object.keys(entry).sort()).toEqual([
            "TreeVirtualItemsDirective",
            "injectTreeVirtualWindow",
            "virtualization",
        ]);
        expect(
            new Set<unknown>(angular.TREE).has(entry.TreeVirtualItemsDirective),
        ).toBe(false);
        expect("injectTreeVirtualWindow" in angular).toBe(false);
        const selection = await import("../selection/public-api");
        expect(Object.keys(selection)).toEqual(["selection"]);
    });

    it("ships the drop indicator from /drag-and-drop (and /foreign-drop), out of TREE, named as in the React adapter", async () => {
        const entry = await import("../drag-and-drop/public-api");
        expect(Object.keys(entry).sort()).toEqual([
            "TreeDropIndicatorDirective",
            "dragAndDrop",
        ]);
        expect(
            readdirSync(
                join(import.meta.dirname, "../../react/src/drag-and-drop"),
            ),
        ).toContain("drop-indicator.tsx");
        expect(
            new Set<unknown>(angular.TREE).has(
                entry.TreeDropIndicatorDirective,
            ),
        ).toBe(false);
        expect("TreeDropIndicatorDirective" in angular).toBe(false);
        const foreign = await import("../foreign-drop/public-api");
        expect(foreign.TreeDropIndicatorDirective).toBe(
            entry.TreeDropIndicatorDirective,
        );
        expect(Object.keys(await import("../drag-group/public-api"))).toEqual([
            "dragGroup",
        ]);
        expect(Object.keys(await import("../drop-outside/public-api"))).toEqual(
            ["dropOutside"],
        );
    });
});
