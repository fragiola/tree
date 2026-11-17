// From Dockable (fragiola/dockable, site/tests/docs-reference.test.ts), same author and licence.

import { readdirSync, readFileSync } from "node:fs";
import { join, relative } from "node:path";
import { describe, expect, it } from "vitest";
import { readPages } from "../contract.ts";
import { DOCS_DIR } from "../sources.ts";

// The API reference is written by hand, and this test keeps it honest.
//
// Why by hand: Fumadocs generates prop tables with fumadocs-typescript (`AutoTypeTable`), which
// drives the TypeScript compiler API to read the types. This repo pins TypeScript 7, the native
// (Go) compiler, which ships no JavaScript compiler API, so fumadocs-typescript cannot run. The
// tables live in site/docs/api/*.mdx instead, and the checks below fail when the sources and the
// pages drift apart:
//
// - every export of @fragiola/tree-react (index.ts, and the parts in parts.ts) is on its
//   reference page; every `Tree.<Part>` has its own page, whose `## Props` table lists exactly
//   the props its `<Part>Props` interface declares; every field of every other exported interface
//   (a state, a hook's result) is a row of its page's tables; every hook has its section;
// - the core pages cover every command (with every payload and result field, taken from the
//   registry itself), every error code, every export of the core, every field of the JSON types,
//   every member of the model and the engine, every key of their `get`/`is`/`run` registries and
//   every key binding;
// - the concept pages list every part and every state attribute the primitives set, and every
//   example is linked from a page.
//
// Interfaces are read with regular expressions (fields are the 4-space-indented `name?:` lines
// of an `export interface … {` block), which is enough for this codebase's formatting (Biome).

const ROOT = join(import.meta.dirname, "../..");
const REACT_SRC = join(ROOT, "packages/react/src");
const CORE_SRC = join(ROOT, "packages/core/src");
const API = join(DOCS_DIR, "api");

const read = (path: string) => readFileSync(path, "utf-8");
const page = (slug: string) => read(join(API, `${slug}.mdx`));
const docsPage = (path: string) => read(join(DOCS_DIR, `${path}.mdx`));

/** What the test reads of a command in the core's registry. */
interface CommandInfo {
    name: string;
    payloadSchema: { properties?: Record<string, unknown> };
    resultSchema: { properties?: Record<string, unknown> };
}

// the core, loaded at run time from its source: a computed path keeps the site's typecheck from
// checking the core too (it has its own)
const core = (await import(join(CORE_SRC, "index.ts"))) as {
    createTreeModel(): { get(key: "commands"): readonly CommandInfo[] };
    DEFAULT_KEY_MAP: Record<string, readonly string[]>;
};
// the keys of the model's verbs, from their registry
const queries = (await import(join(CORE_SRC, "state/queries.ts"))) as {
    MODEL_GET_KEYS: readonly string[];
    MODEL_IS_KEYS: readonly string[];
};
const verbs = read(join(CORE_SRC, "engine/verbs.ts"));

/** The keys of the registry `export interface <name> { … }`: `focus`, `"scroll-to"`, … */
function registryKeys(source: string, name: string): string[] {
    const body =
        new RegExp(
            `export interface ${name}\\b[^{]*\\{([\\s\\S]*?)\\n\\}`,
        ).exec(source)?.[1] ?? "";
    return [...body.matchAll(/^ {4}"?([\w-]+)"?:/gm)].map(
        (match) => match[1] ?? "",
    );
}

/** `key` appears in the page as a quoted key in code: `` `"item-by"` ``. */
function mentionsKey(mdx: string, key: string): boolean {
    return mdx.includes(`\`"${key}"\``);
}

/** The reference page of each module of the React package. */
const MODULE_PAGES: Record<string, string> = {
    "./components/root": "root",
    "./components/items": "items",
    "./components/item": "item",
    "./components/item-content": "item-content",
    "./components/group": "group",
    "./components/toggle": "toggle",
    "./components/checkbox": "checkbox",
    "./components/rename-input": "rename-input",
    "./components/drop-indicator": "drop-indicator",
    "./components/live-region": "live-region",
    "./components/virtual-items": "virtual-items",
    "./hooks/use-tree": "hooks",
    "./hooks/use-tree-item": "hooks",
    "./hooks/use-tree-state": "hooks",
    "./hooks/use-tree-ref": "hooks",
    "./hooks/create-tree-ref": "hooks",
    "./hooks/use-tree-virtual-window": "hooks",
    "./utils/use-render": "root",
};

interface Export {
    name: string;
    module: string;
}

/** `export { a, type B } from "./x"` and `export type { … } from "./x"` statements. */
function namedExports(source: string): Export[] {
    const exports: Export[] = [];
    for (const match of source.matchAll(
        /export (?:type )?\{([^}]*)\} from "([^"]+)"/g,
    )) {
        const [, names = "", module = ""] = match;
        for (const raw of names.split(",")) {
            const name = raw
                .trim()
                .replace(/^type\s+/, "")
                .split(/\s+as\s+/)
                .pop();
            if (name) exports.push({ name, module });
        }
    }
    return exports;
}

/**
 * The fields of `export interface <name> … { … }` (or of `export type <name> … = { … }`) in
 * `source`, or undefined when absent. `extendsNames` are the names in its heritage clause.
 */
function interfaceFields(
    source: string,
    name: string,
): { fields: string[]; extendsNames: string[] } | undefined {
    // an empty body (`extends DivPrimitiveProps<State> {}`) is a body too
    const declared = new RegExp(
        `export interface ${name}\\b([^{]*)\\{(?:\\}|([\\s\\S]*?)\\n\\})`,
    ).exec(source);
    const aliased = new RegExp(
        `export type ${name}\\b(?:<[^>]*>)?\\s*= \\{([\\s\\S]*?)\\n\\}`,
    ).exec(source);
    if (!declared && !aliased) return undefined;
    const heritage = declared?.[1] ?? "";
    const body = (declared ? declared[2] : aliased?.[1]) ?? "";
    const fields = [...body.matchAll(/^ {4}(?:readonly )?(\w+)\??:/gm)].map(
        (field) => field[1] ?? "",
    );
    // the bases after `extends`: not the type parameters (`<T extends …>`), not type arguments
    const bases = heritage
        .replace(/^\s*<[^>]*>/, "")
        .replace(/<[^>]*>/g, "")
        .replace(/^\s*extends\b/, "");
    const extendsNames = [...bases.matchAll(/\b([A-Z]\w*)\b/g)].map(
        (base) => base[1] ?? "",
    );
    return { fields, extendsNames };
}

/** The first-cell names of every markdown table row: `` | `name(…)` | `` gives `name`. */
function tableRowNames(mdx: string): Set<string> {
    const names = new Set<string>();
    for (const match of mdx.matchAll(/^\| `([^`]+)`/gm)) {
        const cell = match[1] ?? "";
        names.add(cell.split(/[(<\s]/)[0] ?? cell);
    }
    return names;
}

/** The part of a page under `## <heading>`, up to the next `##`. */
function section(mdx: string, heading: string): string | undefined {
    const start = mdx.search(new RegExp(`^## ${heading}$`, "m"));
    if (start < 0) return undefined;
    const rest = mdx.slice(start).replace(/^.*\n/, "");
    const end = rest.search(/^## /m);
    return end < 0 ? rest : rest.slice(0, end);
}

/** `name` appears in the page as code: `` `name` ``, `` `name<…>` ``, `` `name(…)` ``. */
function mentions(mdx: string, name: string): boolean {
    return new RegExp(`\`${name}[\`<(.]`).test(mdx);
}

const index = read(join(REACT_SRC, "index.ts"));
const parts = read(join(REACT_SRC, "parts.ts"));
const indexExports = namedExports(index);
const partExports = namedExports(parts);

function sourceOf(module: string): string {
    const file = join(REACT_SRC, module.replace(/^\.\//, ""));
    try {
        return read(`${file}.tsx`);
    } catch {
        return read(`${file}.ts`);
    }
}

describe("the React reference", () => {
    it("re-exports the core and exports the Tree namespace from parts.ts", () => {
        expect(index).toMatch(/^export \* from "@fragiola\/tree";$/m);
        expect(index).toMatch(/export \* as Tree from "\.\/parts"/);
    });

    it("has a page for every module the package exports from", () => {
        const modules = new Set(
            [...indexExports, ...partExports].map((entry) => entry.module),
        );
        for (const module of modules) {
            expect(
                MODULE_PAGES,
                `no reference page for ${module}`,
            ).toHaveProperty(module);
        }
    });

    it("documents every part as Tree.<Part> on its own page", () => {
        expect(partExports.map((entry) => entry.name).sort()).toEqual(
            [
                "Checkbox",
                "DropIndicator",
                "Group",
                "Item",
                "ItemContent",
                "Items",
                "LiveRegion",
                "RenameInput",
                "Root",
                "Toggle",
                "VirtualItems",
            ].sort(),
        );
        for (const { name, module } of partExports) {
            const slug = MODULE_PAGES[module] ?? "";
            expect(page(slug), `api/${slug}.mdx`).toMatch(
                new RegExp(`^title: Tree\\.${name}$`, "m"),
            );
        }
    });

    it("mentions every named export on its module's page", () => {
        expect(indexExports.length).toBeGreaterThan(20);
        for (const { name, module } of indexExports) {
            const slug = MODULE_PAGES[module] ?? "";
            expect(
                mentions(page(slug), name),
                `${name} on api/${slug}.mdx`,
            ).toBe(true);
        }
    });

    it("lists exactly the props of <Part>Props in each part's ## Props table", () => {
        let checked = 0;
        for (const { name, module } of partExports) {
            const source = sourceOf(module);
            const slug = MODULE_PAGES[module] ?? "";
            const mdx = page(slug);
            const props = interfaceFields(source, `${name}Props`);
            expect(props, `${name}Props in ${module}`).toBeDefined();
            const table = section(mdx, "Props");
            expect(table, `## Props on api/${slug}.mdx`).toBeDefined();
            expect(
                [...tableRowNames(table ?? "")].sort(),
                `the ## Props rows of api/${slug}.mdx are ${name}Props' own props`,
            ).toEqual([...(props?.fields ?? [])].sort());
            checked += props?.fields.length ?? 0;
            // a part on the primitive props links them (the root page holds them)
            const primitive = props?.extendsNames.some((base) =>
                base.endsWith("PrimitiveProps"),
            );
            if (primitive && slug !== "root") {
                expect(
                    table,
                    `api/${slug}.mdx links the common props`,
                ).toContain("/docs/api/root#common-props");
            }
        }
        // the parser found the props (a formatting change must not silently pass)
        expect(checked).toBeGreaterThan(25);
    });

    it("has a table row for every field of every other exported interface", () => {
        let checked = 0;
        for (const { name, module } of indexExports) {
            if (name.endsWith("Props")) continue; // the ## Props tables, above
            const found = interfaceFields(sourceOf(module), name);
            if (!found) continue;
            const slug = MODULE_PAGES[module] ?? "";
            const rows = tableRowNames(page(slug));
            for (const field of found.fields) {
                checked++;
                expect(
                    rows.has(field),
                    `${name}.${field} has no row on api/${slug}.mdx`,
                ).toBe(true);
            }
        }
        expect(checked).toBeGreaterThan(25);
    });

    it("documents the common props on the root page", () => {
        const common = interfaceFields(
            read(join(REACT_SRC, "utils/use-render.ts")),
            "PrimitiveProps",
        )?.fields;
        expect(common).toEqual(["render", "className", "style", "ref"]);
        const rows = tableRowNames(section(page("root"), "Common props") ?? "");
        for (const field of common ?? []) {
            expect(rows.has(field), `PrimitiveProps.${field}`).toBe(true);
        }
    });

    it("gives every hook its own section on the hooks page", () => {
        const mdx = page("hooks");
        const hooks = indexExports.filter(
            (entry) =>
                MODULE_PAGES[entry.module] === "hooks" &&
                /^(use|create)[A-Z]/.test(entry.name),
        );
        expect(hooks.map((hook) => hook.name).sort()).toEqual(
            [
                "createTreeRef",
                "useTree",
                "useTreeItem",
                "useTreeRef",
                "useTreeState",
                "useTreeVirtualWindow",
            ].sort(),
        );
        for (const { name } of hooks) {
            expect(mdx, `## \`${name}\` on api/hooks.mdx`).toMatch(
                new RegExp(`^## \`${name}\``, "m"),
            );
        }
    });

    it("gives every element-rendering part its data-tree-part on its page", () => {
        for (const { name, module } of partExports) {
            const part = /"data-tree-part": "([\w-]+)"/.exec(
                sourceOf(module),
            )?.[1];
            if (name === "Items") {
                expect(part).toBeUndefined(); // renders no element of its own
                continue;
            }
            // Item's part is set by useTreeItem
            const value =
                part ??
                /"data-tree-part": "([\w-]+)"/.exec(
                    sourceOf("./hooks/use-tree-item"),
                )?.[1];
            const slug = MODULE_PAGES[module] ?? "";
            expect(page(slug), `api/${slug}.mdx`).toContain(
                `\`data-tree-part="${value}"\``,
            );
        }
    });
});

describe("the Vue reference", () => {
    const VUE_SRC = join(ROOT, "packages/vue/src");
    const vueIndex = read(join(VUE_SRC, "index.ts"));
    const vueParts = namedExports(read(join(VUE_SRC, "parts.ts")));
    const mdx = page("vue");

    it("re-exports the core and exports the Tree namespace from parts.ts", () => {
        expect(vueIndex).toMatch(/^export \* from "@fragiola\/tree";$/m);
        expect(vueIndex).toMatch(/export \* as Tree from "\.\/parts"/);
    });

    it("mentions every named export on api/vue.mdx", () => {
        const names = namedExports(vueIndex).map((entry) => entry.name);
        expect(names.length).toBeGreaterThan(0);
        expect(names.filter((name) => !mentions(mdx, name))).toEqual([]);
    });

    it("lists every part as Tree.<Part> in its components table, the same parts as React's", () => {
        expect(vueParts.map((entry) => entry.name).sort()).toEqual(
            partExports.map((entry) => entry.name).sort(),
        );
        for (const { name } of vueParts) {
            expect(mdx, `Tree.${name}`).toMatch(
                new RegExp(`^\\| \`Tree\\.${name}\` \\|`, "m"),
            );
        }
    });

    it("lists every prop of Tree.Root and every event", () => {
        const root = read(join(VUE_SRC, "components/root.ts"));
        const fields = interfaceFields(root, "RootProps")?.fields ?? [];
        expect(fields.length).toBeGreaterThan(10);
        const row = mdx
            .split("\n")
            .find((line) => line.startsWith("| `Tree.Root` |"));
        for (const field of fields) {
            expect(row, field).toContain(`\`${field}\``);
        }
        for (const event of [
            "update:expandedItemIds",
            "update:selectedItemIds",
            "update:checkedItemIds",
        ]) {
            expect(row, event).toContain(`\`${event}\``);
        }
    });
});

describe("the Angular reference", () => {
    const NG_SRC = join(ROOT, "packages/angular/src");
    const publicApi = read(join(NG_SRC, "public-api.ts"));
    const DIRECTIVES = join(NG_SRC, "lib/directives");
    const directives = readdirSync(DIRECTIVES)
        .filter((file) => file.endsWith(".directive.ts"))
        .map((file) => read(join(DIRECTIVES, file)))
        .flatMap((source) =>
            [
                ...source.matchAll(
                    /selector: "([^"]+)",\n\s+exportAs: "(\w+)",[\s\S]*?export class (\w+)/g,
                ),
            ].map(([, selector = "", exportAs = "", name = ""]) => ({
                selector,
                exportAs,
                name,
            })),
        );
    const mdx = page("angular");

    it("re-exports the core", () => {
        expect(publicApi).toMatch(/^export \* from "@fragiola\/tree";$/m);
    });

    it("mentions every named export on api/angular.mdx", () => {
        const names = namedExports(publicApi).map((entry) => entry.name);
        expect(names.length).toBeGreaterThan(0);
        expect(names.filter((name) => !mentions(mdx, name))).toEqual([]);
    });

    it("lists every directive with its selector and exportAs, and TREE holds them all", () => {
        expect(directives.length).toBe(11);
        for (const { selector, exportAs, name } of directives) {
            expect(mdx, name).toMatch(
                new RegExp(
                    `^\\| \`${name}\` \\| \`${selector.replace(/[[\]]/g, "\\$&")}\` \\| \`${exportAs}\` \\|`,
                    "m",
                ),
            );
        }
        const tree = read(join(NG_SRC, "lib/tree.ts"));
        expect(
            [...tree.matchAll(/^ {4}(\w+Directive),$/gm)]
                .map((match) => match[1])
                .sort(),
        ).toEqual(directives.map((entry) => entry.name).sort());
    });

    it("lists every input and output of the root", () => {
        const root = read(join(DIRECTIVES, "root.directive.ts"));
        const fields = [
            ...root.matchAll(/^ {4}readonly (\w+) = (?:input|output)\b/gm),
        ].map((match) => match[1] ?? "");
        expect(fields.length).toBeGreaterThan(15);
        const row = mdx
            .split("\n")
            .find((line) => line.startsWith("| `TreeRootDirective` |"));
        for (const field of fields) {
            expect(row, field).toContain(`\`${field}\``);
        }
    });
});

describe("the concept pages", () => {
    const componentSources = readdirSync(join(REACT_SRC, "components"))
        .map((file) => read(join(REACT_SRC, "components", file)))
        .concat(read(join(REACT_SRC, "hooks/use-tree-item.ts")));

    it("list every part name", () => {
        const names = new Set(
            componentSources.flatMap((source) =>
                [...source.matchAll(/"data-tree-part": "([\w-]+)"/g)].map(
                    (match) => match[1] ?? "",
                ),
            ),
        );
        expect(names.size).toBe(10);
        const mdx = docsPage("concepts/parts-and-paths");
        for (const name of names) {
            expect(mdx, `part "${name}"`).toContain(`\`${name}\``);
        }
    });

    it("list every state attribute", () => {
        const internal = read(join(REACT_SRC, "hooks/internal.ts"));
        const sources = [internal, ...componentSources].join("\n");
        const attributes = new Set<string>();
        // dataAttributes({ key: value, "key-2": value }) blocks
        for (const block of sources.matchAll(
            /dataAttributes\(\{([\s\S]*?)\}\)/g,
        )) {
            for (const key of (block[1] ?? "").matchAll(
                /^\s*"?([\w-]+)"?:/gm,
            )) {
                attributes.add(`data-${key[1]}`);
            }
        }
        for (const match of sources.matchAll(/"(data-(?!tree-)[\w-]+)"/g)) {
            attributes.add(match[1] ?? "");
        }
        expect(attributes.size).toBeGreaterThan(15);
        const mdx = docsPage("concepts/state-attributes");
        const rows = tableRowNames(mdx);
        for (const attribute of attributes) {
            expect(rows.has(attribute), `${attribute} row`).toBe(true);
        }
        expect(mdx).toContain("`--tree-depth`");
    });

    it("link every example from a page", () => {
        const pages = [...readPages(DOCS_DIR).values()].join("\n");
        const examples = readdirSync(
            join(ROOT, "examples/shared/src/meta"),
        ).map((file) => file.replace(/\.ts$/, ""));
        expect(examples).toHaveLength(15);
        for (const id of examples) {
            expect(
                pages.includes(`<Example id="${id}"`) ||
                    pages.includes(`(/examples/${id})`),
                `example ${id} is linked from no page`,
            ).toBe(true);
        }
    });
});

describe("the core reference", () => {
    const commands = core.createTreeModel().get("commands");
    const commandsPage = page("commands");

    /** The part of the commands page about one command: from its `###` to the next heading. */
    function commandSection(name: string): string {
        const heading = `### \`${name}\``;
        const start = commandsPage.indexOf(heading);
        if (start < 0) return "";
        const rest = commandsPage.slice(start + heading.length);
        const end = rest.search(/^#{2,3} /m);
        return end < 0 ? rest : rest.slice(0, end);
    }

    it("has a section for every command of the registry, with every payload and result field", () => {
        expect(commands.length).toBeGreaterThan(20);
        for (const info of commands) {
            const text = commandSection(info.name);
            expect(text, `### \`${info.name}\` on api/commands.mdx`).not.toBe(
                "",
            );
            const rows = tableRowNames(text);
            for (const schema of [info.payloadSchema, info.resultSchema]) {
                for (const field of Object.keys(schema.properties ?? {})) {
                    expect(rows.has(field), `${info.name}.${field}`).toBe(true);
                }
            }
        }
    });

    it("documents the command bus and every error code", () => {
        const mdx = page("command-bus");
        for (const method of [
            "run",
            "dispatch",
            "can",
            "check",
            "use",
            "subscribe",
            "get",
            "is",
        ]) {
            expect(mdx, `model.${method}`).toContain(`model.${method}`);
        }
        expect(mdx).toContain("`batch`");
        expect(mdx).toContain('model.get("commands")');
        const source = read(join(CORE_SRC, "commands/types.ts"));
        const union =
            /export type CommandErrorCode =([^;]+);/.exec(source)?.[1] ?? "";
        const codes = [...union.matchAll(/"(\w+)"/g)].map((m) => m[1] ?? "");
        expect(codes.length).toBeGreaterThan(5);
        for (const code of codes) {
            expect(mdx, `error code ${code}`).toContain(`\`${code}\``);
        }
    });

    it("mentions every export of the core on an API page", () => {
        const coreIndex = read(join(CORE_SRC, "index.ts"));
        const names = [
            ...namedExports(coreIndex).map((entry) => entry.name),
            // `export { veto } from …` and the rest are named; nothing is re-exported wholesale
        ];
        expect(coreIndex).not.toMatch(/export \* from/);
        expect(names.length).toBeGreaterThan(80);
        const pages = readdirSync(API)
            .filter((file) => file.endsWith(".mdx"))
            .map((file) => read(join(API, file)));
        const missing = names.filter(
            (name) => !pages.some((mdx) => mentions(mdx, name)),
        );
        expect(missing, "exports no API page mentions").toEqual([]);
    });

    it("has a table row for every field of the JSON types", () => {
        const types = read(join(CORE_SRC, "state/types.ts"));
        const json = read(join(CORE_SRC, "state/json.ts"));
        const rows = tableRowNames(page("json-model"));
        let checked = 0;
        for (const [source, names] of [
            [types, ["ItemFlags", "TreeSettings"]],
            [json, ["TreeItemInit", "TreeSettingsJson", "TreeJson"]],
        ] as const) {
            for (const name of names) {
                const fields = interfaceFields(source, name)?.fields ?? [];
                expect(fields.length, name).toBeGreaterThan(0);
                for (const field of fields) {
                    checked++;
                    expect(rows.has(field), `${name}.${field}`).toBe(true);
                }
            }
        }
        // `data` comes from DataField, outside the type's braces
        expect(rows.has("data")).toBe(true);
        expect(checked).toBeGreaterThan(25);
    });

    /** The members of `export interface <name>`: its 4-space-indented fields and methods. */
    function members(source: string, name: string): string[] {
        const start = source.indexOf(`export interface ${name}`);
        expect(start, name).toBeGreaterThanOrEqual(0);
        const body = source.slice(start, source.indexOf("\n}\n", start));
        return [
            ...new Set(
                [...body.matchAll(/^ {4}(?:readonly )?(\w+)[<(:?]/gm)].map(
                    (match) => match[1] ?? "",
                ),
            ),
        ];
    }

    it("documents every member of the engine, of its options and of its adapter", () => {
        const engine = read(join(CORE_SRC, "engine/tree-engine.ts"));
        const adapter = read(join(CORE_SRC, "engine/adapter.ts"));
        const engineMembers = members(engine, "TreeEngine<");
        expect(engineMembers.sort()).toEqual(
            [
                "adapter",
                "can",
                "check",
                "destroy",
                "get",
                "is",
                "run",
                "subscribe",
            ].sort(),
        );
        const options = members(engine, "TreeEngineOptions");
        const adapterMembers = members(adapter, "TreeEngineAdapter");
        expect(adapterMembers.length).toBeGreaterThan(12);
        const mdx = page("engine");
        const rows = tableRowNames(mdx);
        for (const member of [
            ...engineMembers,
            ...options,
            ...adapterMembers,
        ]) {
            expect(rows.has(member), `${member} on api/engine.mdx`).toBe(true);
        }
    });

    it("lists every key of the engine's run, get and is", () => {
        const mdx = page("engine");
        const keys = [
            ...registryKeys(verbs, "EngineActionMap"),
            ...registryKeys(verbs, "EngineGetMap"),
            ...registryKeys(verbs, "EngineIsMap"),
        ];
        expect(keys.length).toBeGreaterThan(12);
        for (const key of keys) {
            expect(mentionsKey(mdx, key), `"${key}" on api/engine.mdx`).toBe(
                true,
            );
        }
    });

    it("lists every key of the model's get and is, and every member of the model", () => {
        const mdx = page("model");
        const keys = [...queries.MODEL_GET_KEYS, ...queries.MODEL_IS_KEYS];
        expect(keys.length).toBeGreaterThan(20);
        for (const key of keys) {
            expect(mentionsKey(mdx, key), `"${key}" on api/model.mdx`).toBe(
                true,
            );
        }
        const source = read(join(CORE_SRC, "state/model.ts"));
        const model = members(source, "TreeModel<");
        expect(model.sort()).toEqual(
            [
                "can",
                "check",
                "dispatch",
                "get",
                "is",
                "run",
                "state",
                "subscribe",
                "use",
            ].sort(),
        );
        const rows = tableRowNames(mdx);
        for (const member of [
            ...model,
            ...members(source, "TreeModelOptions"),
        ]) {
            expect(rows.has(member), `${member} on api/model.mdx`).toBe(true);
        }
    });

    it("lists every key binding of DEFAULT_KEY_MAP on the keyboard guide", () => {
        const mdx = docsPage("guides/keyboard");
        const actions = Object.keys(core.DEFAULT_KEY_MAP);
        expect(actions.length).toBeGreaterThan(15);
        for (const action of actions) {
            expect(mentionsKey(mdx, action), `"${action}"`).toBe(true);
        }
    });
});

// a sanity check on the helper the tests above rely on
describe("the reference helpers", () => {
    it("cut a page at its ## headings", () => {
        const mdx = "## Props\n\n| `a` | x |\n\n## State\n\n| `b` | y |\n";
        expect([...tableRowNames(section(mdx, "Props") ?? "")]).toEqual(["a"]);
        expect(relative(ROOT, API)).toBe(join("site", "docs", "api"));
    });
});
