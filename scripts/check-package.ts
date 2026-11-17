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
//   loads its dev server: a Vite + React app (`reactSmoke`); a Vite + Vue app of single-file
//   components checked by vue-tsc (`vueSmoke`); a Vite app with @analogjs/vite-plugin-angular and a
//   standalone component checked by ngc with strict templates, on packages/angular's TypeScript 6.0
//   (`angularSmoke`). A package published from its build output (`publishConfig.directory`: the
//   Angular one, which ng-packagr builds into `dist`) is packed from that directory: its packed
//   `exports` are the repo's relative to it, each target a file of the tarball.
//
// `--tarballs <dir>` checks the tarballs found in `dir` (at any depth) instead of packing: the
// release workflow passes the directory `changeset pack` wrote, so what is checked is what is
// published. A package with no tarball there (a publish plan may hold only some packages) is
// packed from the repo, as without the option.
import { execFileSync, spawn } from "node:child_process";
import {
    mkdirSync,
    mkdtempSync,
    readdirSync,
    readFileSync,
    rmSync,
    writeFileSync,
} from "node:fs";
import { createServer } from "node:net";
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

/** The version the adapter `packages/<dir>` pins for `name` (a dependency or a dev dependency). */
function adapterVersion(dir: string, name: string): string {
    const manifest = JSON.parse(
        readFileSync(join(root, "packages", dir, "package.json"), "utf8"),
    ) as {
        dependencies?: Record<string, string>;
        devDependencies?: Record<string, string>;
    };
    const version =
        manifest.dependencies?.[name] ?? manifest.devDependencies?.[name];
    if (version === undefined) {
        throw new Error(`packages/${dir} does not depend on ${name}`);
    }
    return version;
}

// Everything from the React package, the core included: a React app installs that one only.
const REACT_SMOKE_MAIN = `import {
    createTreeModel,
    type ItemOf,
    Tree,
    type TreeJson,
    type TreeModel,
} from "@fragiola/tree-react";
import { rename } from "@fragiola/tree-react/rename";
import { selection } from "@fragiola/tree-react/selection";
import { createRoot } from "react-dom/client";

type Types = { items: { folder: undefined; file: { size: number } } };

const json: TreeJson<Types> = {
    version: 1,
    rootItemIds: ["src", "readme"],
    items: {
        src: { kind: "folder", label: "src", childItemIds: ["app"] },
        app: { kind: "file", label: "app.ts", data: { size: 120 } },
        readme: { kind: "file", label: "README.md", data: { size: 3 } },
    },
    expandedItemIds: ["src"],
};

// a feature, from its own entry of the package
const features = [selection(), rename()] as const;
const model: TreeModel<Types, typeof features> = createTreeModel<
    Types,
    typeof features
>(json, { features });

function size(item: ItemOf<Types>): string {
    return item.kind === "file" ? \` (\${item.data.size} B)\` : "";
}

function FileItem({ item }: { item: ItemOf<Types> }) {
    return (
        <Tree.Item item={item}>
            <Tree.ItemContent>
                <Tree.Toggle />
                {item.label}
                {size(item)}
            </Tree.ItemContent>
            <Tree.Group<Types>>{(child) => <FileItem item={child} />}</Tree.Group>
        </Tree.Item>
    );
}

const container = document.getElementById("root");
if (container) {
    createRoot(container).render(
        <Tree.Root<Types> model={model} aria-label="Files">
            <Tree.Items<Types>>{(item) => <FileItem item={item} />}</Tree.Items>
            <Tree.DropIndicator />
            <Tree.LiveRegion />
        </Tree.Root>,
    );
}
`;

/**
 * A scratch Vite + React app in `dir` that depends on the React tarball only: the core tarball is
 * installed as its dependency, never declared by the app. Its versions are the adapter's own (Vite
 * compiles the JSX itself: no plugin is needed to build or serve it).
 */
function writeReactSmokeApp(dir: string, core: string, react: string): void {
    const version = (name: string) => adapterVersion("react", name);
    const manifest = {
        name: "tree-smoke",
        private: true,
        type: "module",
        dependencies: {
            "@fragiola/tree-react": `file:${react}`,
            react: version("react"),
            "react-dom": version("react-dom"),
        },
        devDependencies: {
            "@types/react": version("@types/react"),
            "@types/react-dom": version("@types/react-dom"),
            typescript: version("typescript"),
            vite: version("vite"),
        },
    };
    writeFileSync(
        join(dir, "package.json"),
        `${JSON.stringify(manifest, null, 4)}\n`,
    );
    // The React tarball depends on the core at its own version, which the registry does not have:
    // the packed core stands in for it. A file of its own also keeps the app out of any workspace.
    writeFileSync(
        join(dir, "pnpm-workspace.yaml"),
        `overrides:\n  "@fragiola/tree": "file:${core}"\n`,
    );
    writeFileSync(
        join(dir, "index.html"),
        `<!doctype html>\n<html lang="en">\n<body>\n<div id="root"></div>\n<script type="module" src="/src/main.tsx"></script>\n</body>\n</html>\n`,
    );
    // strict, with the published declarations checked too (no skipLibCheck)
    const tsconfig = {
        compilerOptions: {
            target: "ES2022",
            lib: ["ES2022", "DOM", "DOM.Iterable"],
            module: "ESNext",
            moduleResolution: "bundler",
            jsx: "react-jsx",
            strict: true,
            noUncheckedIndexedAccess: true,
            verbatimModuleSyntax: true,
            noEmit: true,
            types: [],
        },
        include: ["src"],
    };
    writeFileSync(
        join(dir, "tsconfig.json"),
        `${JSON.stringify(tsconfig, null, 4)}\n`,
    );
    mkdirSync(join(dir, "src"));
    writeFileSync(join(dir, "src/main.tsx"), REACT_SMOKE_MAIN);
}

function freePort(): Promise<number> {
    return new Promise((resolve, reject) => {
        const server = createServer();
        server.once("error", reject);
        server.listen(0, "127.0.0.1", () => {
            const address = server.address();
            const port =
                typeof address === "object" && address ? address.port : 0;
            server.close(() => resolve(port));
        });
    });
}

async function fetchOk(url: string): Promise<string> {
    const response = await fetch(url);
    const body = await response.text();
    if (!response.ok) {
        throw new Error(`${url}: ${response.status}\n${body.slice(0, 2000)}`);
    }
    return body;
}

/** The absolute imports of a module served by Vite (`/node_modules/.vite/deps/…`, `/@id/…`). */
export function servedImports(code: string): string[] {
    return [...code.matchAll(/(?:from|import)\s*["'](\/[^"']+)["']/g)].flatMap(
        ([, path]) => (path === undefined ? [] : [path]),
    );
}

/**
 * Starts the app's dev server, loads its entry (`/src/main.tsx`) and every module it imports,
 * then stops it.
 */
async function loadThroughDevServer(
    dir: string,
    entryPath: string,
): Promise<void> {
    const port = await freePort();
    const base = `http://127.0.0.1:${port}`;
    const server = spawn(
        process.execPath,
        [
            join(dir, "node_modules/vite/bin/vite.js"),
            "--host",
            "127.0.0.1",
            "--port",
            String(port),
            "--strictPort",
        ],
        { cwd: dir, stdio: "inherit" },
    );
    const exited = new Promise<void>((resolve) => {
        server.once("exit", () => resolve());
    });
    try {
        const deadline = Date.now() + 30_000;
        for (;;) {
            try {
                await fetchOk(`${base}/`);
                break;
            } catch (error) {
                if (Date.now() > deadline) throw error;
                await new Promise((resolve) => setTimeout(resolve, 250));
            }
        }
        const entry = await fetchOk(`${base}${entryPath}`);
        const imports = servedImports(entry);
        if (!imports.some((path) => path.includes("@fragiola"))) {
            throw new Error(
                `the dev server's entry imports no package:\n${entry}`,
            );
        }
        for (const path of imports) {
            await fetchOk(`${base}${path}`);
        }
        console.log(
            `check-package: the dev server loads the entry (${imports.length} imports)`,
        );
    } finally {
        // the app's directory is removed next: the server must be gone first
        server.kill();
        await exited;
    }
}

/**
 * The React smoke test: the scratch Vite + React app installs the React tarball, typechecks,
 * builds and loads its dev server.
 */
async function reactSmoke(
    app: string,
    tarballs: { core: string; adapter: string },
): Promise<void> {
    writeReactSmokeApp(app, tarballs.core, tarballs.adapter);
    run("pnpm", ["install", "--no-frozen-lockfile"], app);
    run("pnpm", ["exec", "tsc", "--noEmit"], app);
    run("pnpm", ["exec", "vite", "build"], app);
    await loadThroughDevServer(app, "/src/main.tsx");
}

/** The version `examples/<framework>` pins of `name`: the Vue smoke app's tools (vue-tsc, TS 6). */
function examplesVersion(framework: Framework, name: string): string {
    const manifest = JSON.parse(
        readFileSync(join(root, "examples", framework, "package.json"), "utf8"),
    ) as {
        dependencies?: Record<string, string>;
        devDependencies?: Record<string, string>;
    };
    const version =
        manifest.dependencies?.[name] ?? manifest.devDependencies?.[name];
    if (version === undefined) {
        throw new Error(`examples/${framework} does not depend on ${name}`);
    }
    return version;
}

// The Vue smoke app: single-file components typed by the registry through `typedTree<Types>()`,
// with the recursion in a self-referencing component, and a button on a tree ref
// (`:tree-ref="tree"`, read as `tree.value`). Everything comes from the Vue package.
const VUE_SMOKE_TREE = `import { typedTree } from "@fragiola/tree-vue";
import { rename } from "@fragiola/tree-vue/rename";
import { selection } from "@fragiola/tree-vue/selection";

export type Types = { items: { folder: undefined; file: { size: number } } };
// a feature, from its own entry of the package: it types v-model:selected-item-ids
export const features = [selection(), rename()] as const;
export const Tree = typedTree<Types, typeof features>();
`;

const VUE_SMOKE_MAIN = `import { createTreeModel } from "@fragiola/tree-vue";
import { createApp } from "vue";
import App from "./app.vue";
import { features, type Types } from "./tree";

const model = createTreeModel<Types, typeof features>({
    version: 1,
    rootItemIds: ["src", "readme"],
    items: {
        src: { kind: "folder", label: "src", childItemIds: ["app"] },
        app: { kind: "file", label: "app.ts", data: { size: 120 } },
        readme: { kind: "file", label: "README.md", data: { size: 3 } },
    },
    expandedItemIds: ["src"],
}, { features });

createApp(App, { model }).mount("#root");
`;

const VUE_SMOKE_APP = `<script setup lang="ts">
import { type TreeModel, useTreeRef } from "@fragiola/tree-vue";
import { ref } from "vue";
import FileItem from "./file-item.vue";
import { type features, Tree, type Types } from "./tree";

defineProps<{ model: TreeModel<Types, typeof features> }>();
const selected = ref<string[]>([]);
const tree = useTreeRef<Types, typeof features>();
</script>

<template>
    <button type="button" :disabled="!tree.value" @click="tree.value?.model.run('tree.collapse-all', {})">
        Collapse all
    </button>
    <Tree.Root :model="model" :tree-ref="tree" v-model:selected-item-ids="selected" aria-label="Files">
        <Tree.Items v-slot="{ item }"><FileItem :item="item" /></Tree.Items>
        <Tree.DropIndicator />
        <Tree.LiveRegion />
    </Tree.Root>
</template>
`;

const VUE_SMOKE_ITEM = `<script setup lang="ts">
import type { ItemOf } from "@fragiola/tree-vue";
import { Tree, type Types } from "./tree";

defineProps<{ item: ItemOf<Types> }>();
</script>

<template>
    <Tree.Item :item="item">
        <Tree.ItemContent>
            <Tree.Toggle />
            {{ item.label }}
            <!-- item.kind narrows item.data -->
            <span v-if="item.kind === 'file'">{{ item.data.size }}</span>
        </Tree.ItemContent>
        <Tree.Group v-slot="{ item: child }"><FileItem :item="child" /></Tree.Group>
    </Tree.Item>
</template>
`;

/**
 * A scratch Vite + Vue app in `dir` that depends on the Vue tarball only (the core tarball comes
 * as its dependency). It typechecks with vue-tsc on the TypeScript examples/vue pins (vue-tsc does
 * not run on TypeScript 7 yet).
 */
function writeVueSmokeApp(dir: string, core: string, vue: string): void {
    const version = (name: string) => examplesVersion("vue", name);
    const manifest = {
        name: "tree-smoke",
        private: true,
        type: "module",
        dependencies: {
            "@fragiola/tree-vue": `file:${vue}`,
            vue: version("vue"),
        },
        devDependencies: {
            "@vitejs/plugin-vue": version("@vitejs/plugin-vue"),
            typescript: version("typescript"),
            vite: version("vite"),
            "vue-tsc": version("vue-tsc"),
        },
    };
    writeFileSync(
        join(dir, "package.json"),
        `${JSON.stringify(manifest, null, 4)}\n`,
    );
    writeFileSync(
        join(dir, "pnpm-workspace.yaml"),
        `overrides:\n  "@fragiola/tree": "file:${core}"\n`,
    );
    writeFileSync(
        join(dir, "vite.config.js"),
        `import vue from "@vitejs/plugin-vue";\nimport { defineConfig } from "vite";\n\nexport default defineConfig({ plugins: [vue()] });\n`,
    );
    writeFileSync(
        join(dir, "index.html"),
        `<!doctype html>\n<html lang="en">\n<body>\n<div id="root"></div>\n<script type="module" src="/src/main.ts"></script>\n</body>\n</html>\n`,
    );
    // strict, with the published declarations checked too (no skipLibCheck)
    const tsconfig = {
        compilerOptions: {
            target: "ES2022",
            lib: ["ES2022", "DOM", "DOM.Iterable"],
            module: "ESNext",
            moduleResolution: "bundler",
            jsx: "preserve",
            strict: true,
            noUncheckedIndexedAccess: true,
            verbatimModuleSyntax: true,
            noEmit: true,
            types: [],
        },
        include: ["src/**/*.ts", "src/**/*.vue"],
    };
    writeFileSync(
        join(dir, "tsconfig.json"),
        `${JSON.stringify(tsconfig, null, 4)}\n`,
    );
    mkdirSync(join(dir, "src"));
    writeFileSync(join(dir, "src/tree.ts"), VUE_SMOKE_TREE);
    writeFileSync(join(dir, "src/main.ts"), VUE_SMOKE_MAIN);
    writeFileSync(join(dir, "src/app.vue"), VUE_SMOKE_APP);
    writeFileSync(join(dir, "src/file-item.vue"), VUE_SMOKE_ITEM);
}

/**
 * The Vue smoke test: the scratch Vite + Vue app installs the Vue tarball, typechecks (vue-tsc),
 * builds and loads its dev server.
 */
async function vueSmoke(
    app: string,
    tarballs: { core: string; adapter: string },
): Promise<void> {
    writeVueSmokeApp(app, tarballs.core, tarballs.adapter);
    run("pnpm", ["install", "--no-frozen-lockfile"], app);
    run("pnpm", ["exec", "vue-tsc", "--noEmit"], app);
    run("pnpm", ["exec", "vite", "build"], app);
    await loadThroughDevServer(app, "/src/main.ts");
}

// The Angular smoke app: one standalone component, typed by its model's registry through the
// template directive, bootstrapped zoneless; the recursion is one template (a group with no
// template of its own renders with the enclosing one). Everything comes from the Angular package.
const ANGULAR_SMOKE_MAIN = `import {
    Component,
    provideZonelessChangeDetection,
    signal,
} from "@angular/core";
import { bootstrapApplication } from "@angular/platform-browser";
import {
    createTreeModel,
    type ItemOf,
    TREE,
    type TreeJson,
} from "@fragiola/tree-angular";
import { rename } from "@fragiola/tree-angular/rename";
import { selection } from "@fragiola/tree-angular/selection";

type Types = { items: { folder: undefined; file: { size: number } } };

// a feature, from its own entry of the package (a secondary entry point)
const features = [selection(), rename()] as const;

const json: TreeJson<Types> = {
    version: 1,
    rootItemIds: ["src", "readme"],
    items: {
        src: { kind: "folder", label: "src", childItemIds: ["app"] },
        app: { kind: "file", label: "app.ts", data: { size: 120 } },
        readme: { kind: "file", label: "README.md", data: { size: 3 } },
    },
    expandedItemIds: ["src"],
};

@Component({
    selector: "app-root",
    imports: [TREE],
    template: \`
        <div [treeRoot]="model" [(selectedItemIds)]="selected" aria-label="Files">
            <ng-template [treeItems]="model" let-item>
                <div [treeItem]="item">
                    <div treeItemContent>
                        <span treeToggle></span>
                        {{ label(item) }}
                        @if (item.kind === "file") {
                            <span>{{ item.data.size }}</span>
                        }
                    </div>
                    <div treeGroup></div>
                </div>
            </ng-template>
            <div treeDropIndicator></div>
            <div treeLiveRegion></div>
        </div>
    \`,
})
class App {
    readonly model = createTreeModel<Types, typeof features>(json, { features });
    readonly selected = signal<readonly string[]>([]);

    label(item: ItemOf<Types>): string {
        return item.label;
    }
}

bootstrapApplication(App, {
    providers: [provideZonelessChangeDetection()],
}).catch((error: unknown) => console.error(error));
`;

/**
 * A scratch Vite + Angular app in `dir` (@analogjs/vite-plugin-angular) that depends on the
 * Angular tarball only (the core tarball comes as its dependency), on the Angular tools and the
 * TypeScript 6.0 packages/angular pins.
 */
function writeAngularSmokeApp(
    dir: string,
    core: string,
    angular: string,
): void {
    const version = (name: string) => adapterVersion("angular", name);
    const manifest = {
        name: "tree-smoke",
        private: true,
        type: "module",
        dependencies: {
            "@angular/common": version("@angular/common"),
            "@angular/compiler": version("@angular/compiler"),
            "@angular/core": version("@angular/core"),
            "@angular/platform-browser": version("@angular/platform-browser"),
            "@fragiola/tree-angular": `file:${angular}`,
            rxjs: version("rxjs"),
        },
        devDependencies: {
            "@analogjs/vite-plugin-angular": version(
                "@analogjs/vite-plugin-angular",
            ),
            "@angular/build": version("@angular/build"),
            "@angular/compiler-cli": version("@angular/compiler-cli"),
            typescript: version("typescript"),
            vite: version("vite"),
        },
    };
    writeFileSync(
        join(dir, "package.json"),
        `${JSON.stringify(manifest, null, 4)}\n`,
    );
    // the core tarball for the version the Angular tarball pins; the Analog plugin's TypeScript is
    // the app's (6.0), and @angular/build's native helpers keep their prebuilt binaries
    writeFileSync(
        join(dir, "pnpm-workspace.yaml"),
        [
            "overrides:",
            `  "@fragiola/tree": "file:${core}"`,
            "packageExtensions:",
            '  "@analogjs/vite-plugin-angular":',
            "    peerDependencies:",
            '      typescript: "*"',
            "allowBuilds:",
            "  esbuild: true",
            '  "@parcel/watcher": false',
            "  lmdb: false",
            "  msgpackr-extract: false",
            "",
        ].join("\n"),
    );
    writeFileSync(
        join(dir, "vite.config.js"),
        `import angular from "@analogjs/vite-plugin-angular";\nimport { defineConfig } from "vite";\n\nexport default defineConfig({ plugins: [angular({ tsconfig: "tsconfig.json" })] });\n`,
    );
    writeFileSync(
        join(dir, "index.html"),
        `<!doctype html>\n<html lang="en">\n<body>\n<app-root></app-root>\n<script type="module" src="/src/main.ts"></script>\n</body>\n</html>\n`,
    );
    // strict, strict templates, with the published declarations checked too (no skipLibCheck)
    const tsconfig = {
        compilerOptions: {
            target: "ES2022",
            lib: ["ES2022", "DOM", "DOM.Iterable"],
            module: "ESNext",
            moduleResolution: "bundler",
            strict: true,
            noUncheckedIndexedAccess: true,
            verbatimModuleSyntax: true,
            useDefineForClassFields: false,
            types: [],
        },
        angularCompilerOptions: {
            strictTemplates: true,
            strictInjectionParameters: true,
            strictInputAccessModifiers: true,
        },
        include: ["src"],
    };
    writeFileSync(
        join(dir, "tsconfig.json"),
        `${JSON.stringify(tsconfig, null, 4)}\n`,
    );
    mkdirSync(join(dir, "src"));
    writeFileSync(join(dir, "src/main.ts"), ANGULAR_SMOKE_MAIN);
}

/**
 * The Angular smoke test: the scratch Vite + Angular app installs the Angular tarball, typechecks
 * (ngc, strict templates), builds and loads its dev server.
 */
async function angularSmoke(
    app: string,
    tarballs: { core: string; adapter: string },
): Promise<void> {
    writeAngularSmokeApp(app, tarballs.core, tarballs.adapter);
    run("pnpm", ["install", "--no-frozen-lockfile"], app);
    run("pnpm", ["exec", "ngc", "-p", "tsconfig.json", "--noEmit"], app);
    run("pnpm", ["exec", "vite", "build"], app);
    await loadThroughDevServer(app, "/src/main.ts");
}

/** Every adapter, one per package under packages/ but the core (`unlistedPackages` checks it). */
export const ADAPTERS: readonly AdapterCheck[] = [
    { dir: "react", framework: "react", smoke: reactSmoke },
    { dir: "vue", framework: "vue", smoke: vueSmoke },
    { dir: "angular", framework: "angular", smoke: angularSmoke },
];

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
