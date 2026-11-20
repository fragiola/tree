import { readdirSync, readFileSync, statSync } from "node:fs";
import { join, relative } from "node:path";
import {
    collectFiles,
    type ExampleEntry,
    examplesApp,
    importsOf,
    listExampleSlugs,
    loadExamples,
} from "examples-shared/scripts/examples-lib";
import { beforeAll, describe, expect, it } from "vitest";

// The Angular side of the example contract (examples/react/tests/examples.test.ts is the React
// one): every example of examples/react exists here with the same id, is standalone components
// with inline templates (`index.ts` its entry, default-exporting the example's component) and
// `styles.ts`, imports only what a consumer can copy, assembles the tree itself, and keeps its
// classes in styles.ts. The kit is the React kit, for Angular.

const APP = examplesApp("angular");
const EXAMPLES_DIR = APP.examplesDir;

/** What an example file may import, besides relative files inside examples/. */
const ALLOWED = [
    /^@angular\/(core|common)$/,
    // the adapter and its feature entries (`@fragiola/tree-angular/selection`)
    /^@fragiola\/tree-angular(?:\/[a-z-]+)?$/,
    /^@lucide\/angular$/,
    /^#\/components\/(ui|atoms)\/[a-z-]+$/,
    /^#\/lib\/cn$/,
];

const KIT_FILES = [
    "data.ts",
    "loader.ts",
    "persist.ts",
    "undo.ts",
    "warehouse-live.ts",
];

function walk(dir: string): string[] {
    return readdirSync(dir).flatMap((name) => {
        const path = join(dir, name);
        return statSync(path).isDirectory() ? walk(path) : [path];
    });
}

const read = (file: string) => readFileSync(file, "utf-8");

let examples: ExampleEntry[] = [];

beforeAll(async () => {
    examples = await loadExamples(APP);
});

describe("the Angular examples", () => {
    const slugs = listExampleSlugs(APP);

    it("are every example of examples/react, with the same ids, all in the manifest", () => {
        expect(slugs).toEqual(listExampleSlugs(examplesApp("react")));
        expect(examples.map((example) => example.slug).sort()).toEqual(slugs);
    });

    it.each(slugs)("%s imports only what a consumer copies", (slug) => {
        const { files } = collectFiles(APP, slug);
        expect(files[0]).toBe(`${slug}/index.ts`);
        for (const file of files) {
            for (const specifier of importsOf(read(join(EXAMPLES_DIR, file)))) {
                if (specifier.startsWith(".")) continue;
                expect(
                    ALLOWED.some((pattern) => pattern.test(specifier)),
                    `${file}: ${specifier}`,
                ).toBe(true);
            }
        }
    });

    it.each(slugs)(
        "%s shows in the code panel the files it is compiled from",
        (slug) => {
            const example = examples.find((entry) => entry.slug === slug);
            expect(example?.files).toEqual(collectFiles(APP, slug).files);
        },
    );

    it.each(slugs)("%s assembles the tree in its own files", (slug) => {
        const own = walk(join(EXAMPLES_DIR, slug)).map(read);
        expect(own.some((source) => source.includes("treeRoot"))).toBe(true);
    });

    it.each(slugs)("%s default-exports its component", (slug) => {
        const source = read(join(EXAMPLES_DIR, slug, "index.ts"));
        expect(source).toMatch(/^export default class \w+/m);
    });

    it.each(slugs)("%s keeps its classes in styles.ts", (slug) => {
        expect(
            statSync(join(EXAMPLES_DIR, slug, "styles.ts"), {
                throwIfNoEntry: false,
            })?.isFile(),
        ).toBe(true);
        for (const file of walk(join(EXAMPLES_DIR, slug))) {
            if (file.endsWith("styles.ts")) continue;
            const source = read(file);
            // looks go in styles.ts and are bound (`[class]="styles.part"`)
            expect(/\sclass="/.test(source), relative(EXAMPLES_DIR, file)).toBe(
                false,
            );
            expect(/\bcn\(/.test(source), relative(EXAMPLES_DIR, file)).toBe(
                false,
            );
        }
    });

    it("use the app's API only: never engine.adapter (an adapter's side)", () => {
        for (const file of walk(EXAMPLES_DIR)) {
            if (!file.endsWith(".ts")) continue;
            expect(read(file), relative(EXAMPLES_DIR, file)).not.toMatch(
                /\.adapter\b/,
            );
        }
    });
});

describe("the app", () => {
    // an Angular app installs one package: the Angular package brings the core and re-exports it
    const APP_ROOT = join(import.meta.dirname, "..");

    it("depends on @fragiola/tree-angular only, and never imports @fragiola/tree", () => {
        const manifest = read(join(APP_ROOT, "package.json"));
        expect(manifest).toContain('"@fragiola/tree-angular"');
        expect(manifest).not.toContain('"@fragiola/tree"');
        const files = ["src", "tests"]
            .flatMap((dir) => walk(join(APP_ROOT, dir)))
            .filter((file) => file.endsWith(".ts"));
        for (const file of files) {
            expect(
                importsOf(read(file)),
                relative(APP_ROOT, file),
            ).not.toContain("@fragiola/tree");
        }
    });
});

describe("the kit", () => {
    it("is the React kit, importing the Angular package", () => {
        expect(readdirSync(join(EXAMPLES_DIR, "_kit")).sort()).toEqual(
            [...KIT_FILES].sort(),
        );
        const react = join(examplesApp("react").examplesDir, "_kit");
        for (const file of KIT_FILES) {
            const original = read(join(react, file)).replaceAll(
                "@fragiola/tree-react",
                "@fragiola/tree-angular",
            );
            expect(read(join(EXAMPLES_DIR, "_kit", file)), file).toBe(original);
        }
    });
});
