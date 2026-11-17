// Fails when a package cannot be published as it is. Run by `pnpm check:package`, after the
// packages built. From Dockable (fragiola/dockable, scripts/check-package.ts), same author and
// licence. Each package is packed with pnpm, which applies `publishConfig` as the publish does (npm
// would not: the packages are only ever packed and published through pnpm), then:
//
// - its packed `exports` (from `publishConfig.exports`) are the repo's `exports` without the source
//   condition, and use only the `types`, `import` and `default` conditions, with targets in `dist`;
// - publint (strict) and attw (`esm-only` profile) pass on the tarball;
// - every adapter (`ADAPTERS`: each package under packages/ but the core) depends on the core at
//   its exact version, and passes its smoke test: a scratch app outside the workspace that installs
//   the adapter's tarball only (the core tarball comes as its dependency), typechecks, builds and
//   loads its dev server. The core has no adapter yet: each adapter Epic adds its entry and its
//   smoke app (Dockable's `reactSmoke`, `vueSmoke`, `angularSmoke` are the model).
//
// `--tarballs <dir>` checks the tarballs found in `dir` (at any depth) instead of packing: the
// release workflow passes the directory `changeset pack` wrote, so what is checked is what is
// published. A package with no tarball there (a publish plan may hold only some packages) is
// packed from the repo, as without the option.
import { execFileSync } from "node:child_process";
import { mkdtempSync, readdirSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { SOURCE_CONDITION } from "./source-condition.ts";

const root = join(import.meta.dirname, "..");

/** The only conditions a published `exports` may use: ESM, with its types. */
const PUBLISHED_CONDITIONS = ["types", "import", "default"];

/** A published target is in `dist` (`./dist/…`). */
const inDist = (target: string) => target.startsWith("./dist/");

/**
 * What is wrong with published `exports`: a condition other than `types`, `import` and `default`
 * (a source condition, `development`, …), or a target outside `dist` (`published` says what is
 * published, for a package packed from its build output: the tarball's files).
 */
export function exportProblems(
    exports: unknown,
    path = "exports",
    published: (target: string) => boolean = inDist,
): string[] {
    if (typeof exports === "string") {
        return published(exports) || exports === "./package.json"
            ? []
            : [`${path}: "${exports}" is not in dist`];
    }
    if (exports === null || typeof exports !== "object") {
        return [`${path}: not a string or an object`];
    }
    return Object.entries(exports).flatMap(([key, value]) => [
        ...(key.startsWith(".") || PUBLISHED_CONDITIONS.includes(key)
            ? []
            : [`${path}: the "${key}" condition is published`]),
        ...exportProblems(value, `${path}["${key}"]`, published),
    ]);
}

/**
 * `exports` with every target relative to `directory` (`./dist/x` is `./x` for `dist`): what a
 * package packed from `directory` (`publishConfig.directory`) publishes.
 */
export function relativeTo(exports: unknown, directory: string): unknown {
    const prefix = `./${directory.replace(/^\.\/|\/$/g, "")}/`;
    if (typeof exports === "string") {
        return exports.startsWith(prefix)
            ? `./${exports.slice(prefix.length)}`
            : exports;
    }
    if (exports === null || typeof exports !== "object") return exports;
    return Object.fromEntries(
        Object.entries(exports).map(([key, value]) => [
            key,
            relativeTo(value, directory),
        ]),
    );
}

/** `exports` without the source condition, at any depth (key order kept: it is the priority). */
export function withoutSource(exports: unknown): unknown {
    if (exports === null || typeof exports !== "object") return exports;
    return Object.fromEntries(
        Object.entries(exports)
            .filter(([key]) => key !== SOURCE_CONDITION)
            .map(([key, value]) => [key, withoutSource(value)]),
    );
}

/**
 * Whether the published `exports` (`publishConfig.exports`, a hand-written copy) are the repo's
 * `exports` without the source condition: the same subpaths, conditions, order and targets.
 */
export function publishedExportsProblems(
    exports: unknown,
    published: unknown,
): string[] {
    const expected = JSON.stringify(withoutSource(exports));
    const actual = JSON.stringify(published);
    return expected === actual
        ? []
        : [`published exports ${actual} are not the exports ${expected}`];
}

/** The directory of `--tarballs <dir>` (or `--tarballs=<dir>`), if given; any other argument throws. */
export function tarballsOption(args: string[]): string | undefined {
    let dir: string | undefined;
    for (let i = 0; i < args.length; i++) {
        const arg = args[i];
        if (arg === "--tarballs") {
            dir = args[++i];
            if (dir === undefined || dir.startsWith("--")) {
                throw new Error("--tarballs needs a directory");
            }
        } else if (arg?.startsWith("--tarballs=")) {
            dir = arg.slice("--tarballs=".length);
            if (dir === "") throw new Error("--tarballs needs a directory");
        } else {
            throw new Error(`unknown argument: ${arg}`);
        }
    }
    return dir;
}

/** The `.tgz` files under `dir`, at any depth, sorted. */
export function findTarballs(dir: string): string[] {
    return readdirSync(dir, { recursive: true, withFileTypes: true })
        .filter((entry) => entry.isFile() && entry.name.endsWith(".tgz"))
        .map((entry) => join(entry.parentPath, entry.name))
        .sort();
}

function run(command: string, args: string[], cwd: string): void {
    execFileSync(command, args, { cwd, stdio: "inherit" });
}

/** `pnpm pack` of `packages/<name>` into `dir`; returns the tarball's path. */
function pack(name: string, dir: string): string {
    const output = execFileSync(
        "pnpm",
        ["pack", "--pack-destination", dir, "--json"],
        { cwd: join(root, "packages", name), encoding: "utf8" },
    );
    const { filename } = JSON.parse(output) as { filename: string };
    return filename;
}

interface PackedManifest {
    name: string;
    version: string;
    exports?: unknown;
    dependencies?: Record<string, string>;
}

function packedManifest(tarball: string): PackedManifest {
    return JSON.parse(
        execFileSync("tar", ["-xOzf", tarball, "package/package.json"], {
            encoding: "utf8",
        }),
    );
}

/** `packages/<name>/package.json`: its `exports` (the source condition included), what it packs. */
function repoManifest(name: string): {
    exports?: unknown;
    publishConfig?: { directory?: string };
} {
    return JSON.parse(
        readFileSync(join(root, "packages", name, "package.json"), "utf8"),
    );
}

/** The files of a tarball, as `./path` relative to the package. */
function tarballFiles(tarball: string): Set<string> {
    return new Set(
        execFileSync("tar", ["-tzf", tarball], { encoding: "utf8" })
            .split("\n")
            .filter((line) => line.startsWith("package/"))
            .map((line) => `./${line.slice("package/".length)}`),
    );
}

function lint(name: string, tarball: string): string[] {
    const manifest = packedManifest(tarball);
    const repo = repoManifest(name);
    const directory = repo.publishConfig?.directory;
    const files = tarballFiles(tarball);
    const problems = (
        directory === undefined
            ? [
                  ...exportProblems(manifest.exports),
                  ...publishedExportsProblems(repo.exports, manifest.exports),
              ]
            : [
                  ...exportProblems(manifest.exports, "exports", (target) =>
                      files.has(target),
                  ),
                  ...publishedExportsProblems(
                      relativeTo(repo.exports, directory),
                      manifest.exports,
                  ),
              ]
    ).map((problem) => `${manifest.name}: ${problem}`);
    run("pnpm", ["exec", "publint", tarball, "--strict"], root);
    run("pnpm", ["exec", "attw", tarball, "--profile", "esm-only"], root);
    return problems;
}

/** The frameworks an adapter is written for. */
export type Framework = "react" | "vue" | "angular";

/** What `check:package` checks of an adapter, besides what every package gets. */
export interface AdapterCheck {
    /** its directory, `packages/<dir>` */
    dir: string;
    /** the framework whose examples app (`examples/<framework>`) pins the smoke app's versions */
    framework: Framework;
    /**
     * Its smoke test, in an empty scratch directory outside the workspace: an app that installs
     * the adapter's tarball only (the core tarball comes as its dependency), typechecks, builds and
     * loads its dev server. Throws on any failure.
     */
    smoke: (
        app: string,
        tarballs: { core: string; adapter: string },
    ) => Promise<void>;
}

/** Every adapter, one per package under packages/ but the core (`unlistedPackages` checks it). */
export const ADAPTERS: readonly AdapterCheck[] = [];

/** The packages/ directories that are neither the core nor an adapter of `adapters`. */
export function unlistedPackages(
    dirs: readonly string[],
    adapters: readonly AdapterCheck[] = ADAPTERS,
): string[] {
    return dirs.filter(
        (dir) =>
            dir !== "core" && !adapters.some((adapter) => adapter.dir === dir),
    );
}

/**
 * Why an adapter's packed manifest does not pin the core at its exact version, or nothing: one
 * core per page (the drag state is page-wide), whatever the adapters a page loads.
 */
export function corePinProblem(
    adapter: { name: string; dependencies?: Record<string, string> },
    coreVersion: string,
): string | undefined {
    const pinned = adapter.dependencies?.["@fragiola/tree"];
    return pinned === coreVersion
        ? undefined
        : `${adapter.name} depends on the core at "${pinned}", not at ${coreVersion}`;
}

/** The name of `packages/<name>/package.json` (`@fragiola/…`). */
function packageName(name: string): string {
    const manifest = JSON.parse(
        readFileSync(join(root, "packages", name, "package.json"), "utf8"),
    ) as { name: string };
    return manifest.name;
}

/**
 * A tarball for each of `packages/*`, by directory name: the one in `given` (`--tarballs`) when
 * there is one, else `pnpm pack` into `packs`. A given tarball of no package of the repo throws.
 */
function tarballsFor(
    names: string[],
    packs: string,
    given: string | undefined,
): Map<string, string> {
    const byPackage = new Map<string, string>();
    if (given !== undefined) {
        const found = findTarballs(resolve(given));
        if (found.length === 0) {
            throw new Error(`--tarballs: no .tgz file under ${given}`);
        }
        for (const tarball of found) {
            byPackage.set(packedManifest(tarball).name, tarball);
        }
    }
    const tarballs = new Map<string, string>();
    for (const name of names) {
        const manifestName = packageName(name);
        const tarball = byPackage.get(manifestName);
        byPackage.delete(manifestName);
        console.log(
            `check-package: ${manifestName} from ${tarball ?? "pnpm pack"}`,
        );
        tarballs.set(name, tarball ?? pack(name, packs));
    }
    if (byPackage.size > 0) {
        throw new Error(
            `--tarballs: no package of the repo is ${[...byPackage.keys()].join(", ")}`,
        );
    }
    return tarballs;
}

async function main() {
    const given = tarballsOption(process.argv.slice(2));
    const packs = mkdtempSync(join(tmpdir(), "tree-pack-"));
    const apps: string[] = [];
    try {
        const names = readdirSync(join(root, "packages"));
        const tarballs = tarballsFor(names, packs, given);
        const problems = [...tarballs].flatMap(([name, tarball]) =>
            lint(name, tarball),
        );
        if (problems.length > 0) {
            throw new Error(
                `The packed exports are wrong:\n${problems.join("\n")}`,
            );
        }
        const unlisted = unlistedPackages(names);
        if (unlisted.length > 0) {
            throw new Error(
                `packages/${unlisted.join(", packages/")}: not the core and not in ADAPTERS (scripts/check-package.ts)`,
            );
        }
        const core = tarballs.get("core");
        if (core === undefined) throw new Error("packages/core is expected");
        const coreVersion = packedManifest(core).version;
        for (const adapter of ADAPTERS) {
            const tarball = tarballs.get(adapter.dir);
            if (tarball === undefined) {
                throw new Error(`packages/${adapter.dir} is expected`);
            }
            const problem = corePinProblem(
                packedManifest(tarball),
                coreVersion,
            );
            if (problem) throw new Error(problem);
            const app = mkdtempSync(
                join(tmpdir(), `tree-smoke-${adapter.dir}-`),
            );
            apps.push(app);
            await adapter.smoke(app, { core, adapter: tarball });
            console.log(`check-package: ${adapter.dir}: the smoke app passes`);
        }
        console.log("check-package: every package can be published");
    } finally {
        for (const dir of [packs, ...apps]) {
            rmSync(dir, { recursive: true, force: true, maxRetries: 5 });
        }
    }
}

// only when run, not when a test imports it (`import.meta.main` holds through a symlinked path)
if (import.meta.main) {
    await main();
}
