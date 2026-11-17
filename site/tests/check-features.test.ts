import { describe, expect, it } from "vitest";
import {
    FEATURES,
    featureLeaks,
    mainEntryOf,
    mapSources,
} from "../../scripts/check-features.ts";

// `pnpm build` runs scripts/check-features.ts over every package's built main entry: it fails when
// one ships a feature's code. These pin the check itself on planted builds.

/** A build of named files and their source maps, as the guard reads a `dist`. */
function built(
    files: Record<string, string>,
    maps: Record<string, readonly string[]> = {},
) {
    return {
        read: (name: string) => files[name],
        readMap: (name: string) =>
            maps[name] && JSON.stringify({ version: 3, sources: maps[name] }),
    };
}

describe("the features' bundle guard", () => {
    it("passes a main entry, and its chunks, built from the core's own sources", () => {
        const { read, readMap } = built(
            {
                "index.js": 'import { a } from "./shared-1.js";\nexport { a };',
                "shared-1.js": "export const a = 1;",
            },
            {
                "index.js": ["../src/index.ts", "../src/state/model.ts"],
                "shared-1.js": ["../src/commands/item.ts"],
            },
        );
        expect(featureLeaks("index.js", read, readMap, FEATURES)).toEqual([]);
    });

    it("fails a planted import: a chunk of the main entry built from a feature's folder", () => {
        const { read, readMap } = built(
            {
                "index.js": 'import { s } from "./shared-1.js";\nexport { s };',
                "shared-1.js": "export const s = 1;",
            },
            {
                "index.js": ["../src/index.ts"],
                "shared-1.js": ["../src/selection/selection.ts"],
            },
        );
        expect(featureLeaks("index.js", read, readMap, FEATURES)).toEqual([
            "shared-1.js: selection's ../src/selection/selection.ts",
        ]);
    });

    it("fails an adapter's main entry built from its feature folder, tsdown's or ng-packagr's", () => {
        const { read, readMap } = built(
            {
                "index.js": "export const a = 1;",
                "fesm2022/fragiola-tree-angular.mjs": "export const b = 1;",
            },
            {
                "index.js": ["../src/virtualization/virtual-items.tsx"],
                "fesm2022/fragiola-tree-angular.mjs": [
                    "../../virtualization/virtual-items.directive.ts",
                ],
            },
        );
        expect(featureLeaks("index.js", read, readMap, FEATURES)).toEqual([
            "index.js: virtualization's ../src/virtualization/virtual-items.tsx",
        ]);
        expect(
            featureLeaks(
                "fesm2022/fragiola-tree-angular.mjs",
                read,
                readMap,
                FEATURES,
            ),
        ).toEqual([
            "fesm2022/fragiola-tree-angular.mjs: virtualization's ../../virtualization/virtual-items.directive.ts",
        ]);
    });

    it("fails a main entry that imports a feature's entry point", () => {
        const { read, readMap } = built({
            "index.js":
                'export { virtualization } from "@fragiola/tree/virtualization";',
        });
        expect(featureLeaks("index.js", read, readMap, FEATURES)).toEqual([
            "index.js: imports the virtualization entry",
        ]);
    });

    it("ignores a feature's own entry, which the main entry does not import", () => {
        const { read, readMap } = built(
            {
                "index.js": "export const core = 1;",
                "selection.js": "export const selection = 1;",
            },
            { "selection.js": ["../src/selection/selection.ts"] },
        );
        expect(featureLeaks("index.js", read, readMap, FEATURES)).toEqual([]);
    });

    it("reads a source map's sources, and nothing from a missing one", () => {
        expect(mapSources(undefined)).toEqual([]);
        expect(mapSources('{"sources":["a.ts",1]}')).toEqual(["a.ts"]);
    });

    it("finds tsdown's and ng-packagr's main entry", () => {
        expect(mainEntryOf("/nowhere", "@fragiola/tree")).toBeUndefined();
    });
});
