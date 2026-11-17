// The features' bundle guard: a feature not imported is not in the app's bundle. Fails when the
// main entry of a package (`packages/*/dist/index.js`, or ng-packagr's
// `dist/fesm2022/<package>.mjs`), or a chunk it imports, holds a feature's code: a source its
// source map names under a feature's folder (`src/selection/`, `src/virtual/`), or an import of a
// feature's entry point (`@fragiola/tree…/selection`). Run by `pnpm build`, after the packages
// built. The feature/subpath list and the main-entry walk follow Data Grid's
// (fragiola/data-grid, scripts/check-features.ts), same author and licence; the tree checks the
// source maps, since its core names every feature's keys (to refuse them when not installed).
import { existsSync, readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { chunksOf } from "./built-files.ts";

const root = join(import.meta.dirname, "..");

/**
 * The features: each one's entry point (its subpath, in every package that has it) and the
 * folders of its code, as a package's source maps name them (`src/selection/`).
 */
export const FEATURES: readonly FeatureSources[] = [
    // the core's folder, each adapter's (`src/selection/`), and an Angular secondary entry's
    // (`packages/angular/selection/`, `../../selection/` from its fesm bundles)
    { subpath: "selection", folders: ["src/selection/", "../../selection/"] },
    {
        subpath: "virtualization",
        folders: [
            "src/virtual/",
            "src/virtualization/",
            "../../virtualization/",
        ],
    },
];

/** A feature as the guard reads it: its subpath and the source folders of its code. */
export interface FeatureSources {
    readonly subpath: string;
    readonly folders: readonly string[];
}

/** An import of a feature's entry point, from any package: `@fragiola/<package>/<subpath>`. */
function importsSubpath(source: string, subpath: string): boolean {
    return new RegExp(
        `(?:from|import)\\s*\\(?\\s*["']@fragiola/[\\w-]+/${subpath}(?:/[^"']*)?["']`,
    ).test(source);
}

/** The sources a built file's source map names, as written there (`../src/selection/state.ts`). */
export function mapSources(map: string | undefined): string[] {
    if (map === undefined) return [];
    const parsed = JSON.parse(map) as { sources?: unknown };
    return Array.isArray(parsed.sources)
        ? parsed.sources.filter(
              (source): source is string => typeof source === "string",
          )
        : [];
}

/**
 * The feature code a main entry holds, through the chunks it imports: one line per feature source
 * or feature import found, with the file it is in. `read` gives a built file's source by its name
 * relative to the entry's folder, and `readMap` its source map (`undefined` for none).
 */
export function featureLeaks(
    main: string,
    read: (name: string) => string | undefined,
    readMap: (name: string) => string | undefined,
    features: readonly FeatureSources[],
): string[] {
    const leaks: string[] = [];
    const seen = new Set<string>();
    const visit = (name: string) => {
        if (seen.has(name)) return;
        seen.add(name);
        const source = read(name);
        if (source === undefined) return;
        const sources = mapSources(readMap(name)).map((path) =>
            path.replaceAll("\\", "/"),
        );
        for (const { subpath, folders } of features) {
            if (importsSubpath(source, subpath)) {
                leaks.push(`${name}: imports the ${subpath} entry`);
            }
            for (const path of sources) {
                if (folders.some((folder) => path.includes(folder))) {
                    leaks.push(`${name}: ${subpath}'s ${path}`);
                }
            }
        }
        for (const chunk of chunksOf(source)) visit(chunk);
    };
    visit(main);
    return leaks;
}

/** A package's main entry, relative to its `dist`: tsdown's or ng-packagr's. */
export function mainEntryOf(
    dist: string,
    packageName: string,
): string | undefined {
    if (existsSync(join(dist, "index.js"))) return "index.js";
    const fesm = `fesm2022/${packageName.replace(/^@/, "").replace("/", "-")}.mjs`;
    return existsSync(join(dist, fesm)) ? fesm : undefined;
}

function main() {
    const problems: string[] = [];
    for (const pkg of readdirSync(join(root, "packages"))) {
        const dir = join(root, "packages", pkg);
        const dist = join(dir, "dist");
        const name = (
            JSON.parse(readFileSync(join(dir, "package.json"), "utf8")) as {
                name: string;
            }
        ).name;
        const entry = existsSync(dist) ? mainEntryOf(dist, name) : undefined;
        if (!entry) {
            problems.push(`packages/${pkg}: no built main entry`);
            continue;
        }
        const folder = join(dist, entry.includes("/") ? "fesm2022" : "");
        const read = (file: string) => {
            const path = join(folder, file.replace(/^fesm2022\//, ""));
            return existsSync(path) ? readFileSync(path, "utf8") : undefined;
        };
        const readMap = (file: string) => read(`${file}.map`);
        for (const leak of featureLeaks(entry, read, readMap, FEATURES)) {
            problems.push(`packages/${pkg}/dist/${leak}`);
        }
    }
    if (problems.length > 0) {
        console.error(
            `A main entry ships a feature's code (a feature must stay in its own entry):\n${problems.join("\n")}`,
        );
        process.exit(1);
    }
    console.log(
        `check-features: no package's main entry ships ${FEATURES.map((feature) => feature.subpath).join(", ")}`,
    );
}

if (process.argv[1] === import.meta.filename) {
    main();
}
