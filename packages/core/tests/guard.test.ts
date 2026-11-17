// From Dockable (fragiola/dockable, packages/core/tests/guard.test.ts), same author and licence.
import { existsSync, readdirSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const root = join(import.meta.dirname, "..");
const src = join(root, "src");

function listFiles(dir: string): string[] {
    return readdirSync(dir).flatMap((name) => {
        const path = join(dir, name);
        return statSync(path).isDirectory() ? listFiles(path) : [path];
    });
}

/** Source text with comments and string literals blanked out, so only code is scanned. */
function codeOnly(source: string): string {
    return source.replace(
        /\/\*[\s\S]*?\*\/|\/\/[^\n]*|"(?:\\.|[^"\\\n])*"|'(?:\\.|[^'\\\n])*'|`(?:\\.|[^`\\])*`/g,
        (match) => (match.startsWith("/") ? "" : '""'),
    );
}

// the core never reaches for the browser globals: DOM access goes through the root element's
// ownerDocument/defaultView, so it also runs in an iframe and the model loads in Node
const GLOBAL_DOM =
    /(?<![.\w$])(document|window|requestAnimationFrame|cancelAnimationFrame|ResizeObserver|MutationObserver|getComputedStyle|navigator|localStorage|sessionStorage)\b(?!\s*:)/;
const GLOBAL_CRYPTO = /(?<![.\w$])crypto\b(?!\s*:)/;

/**
 * The files ported from React Complex Tree (`../references/react-complex-tree`, MIT, © Lukas
 * Bach): they keep a header naming it, its copyright and its licence.
 */
const PORTED: readonly string[] = ["src/drop-target/drop-evaluation.ts"];

/**
 * The exported declarations of a source (comments and strings already blanked): each `export`
 * statement up to its end (the first `;` or blank-line-terminated block at column 0).
 */
function exportedDeclarations(source: string): string[] {
    const declarations: string[] = [];
    const lines = source.split("\n");
    for (let i = 0; i < lines.length; i++) {
        const line = lines[i] ?? "";
        if (!line.startsWith("export ")) {
            continue;
        }
        const block = [line];
        // a multi-line declaration runs until a line closing it at column 0
        if (!/;\s*$/.test(line) && !/^export \{.*\}.*;?$/.test(line)) {
            for (let j = i + 1; j < lines.length; j++) {
                const next = lines[j] ?? "";
                block.push(next);
                if (/^[}\]);]/.test(next)) {
                    break;
                }
            }
        }
        declarations.push(block.join("\n"));
    }
    return declarations;
}

/** CSS class names, label defaults and translation never live in the core. */
const FORBIDDEN =
    /\b(CLASSES|CSSClassNames|className|I18nLabel|translate|i18n)\b/;

/** Any UI framework an adapter wraps: the core imports none of them. */
const IMPORT_FRAMEWORK =
    /(?:from\s+|import\s+|import\s*\(\s*|require\s*\(\s*)["'](?:react|react-dom|vue|@vue\/[^"']+|@angular\/[^"']+)(?:\/[^"']*)?["']/;

/** Whether a file starts with the header of a file ported from React Complex Tree. */
function hasUpstreamHeader(source: string): boolean {
    // the leading line comments, joined into one sentence
    const head = (/^(?:\/\/[^\n]*\n)+/.exec(source)?.[0] ?? "").replace(
        /\s*\n\/\/\s*|\s+/g,
        " ",
    );
    return (
        head.includes("React Complex Tree") &&
        head.includes("Lukas Bach") &&
        head.includes("MIT")
    );
}

describe("core package guard", () => {
    it("has no runtime or peer dependencies", () => {
        const pkg = JSON.parse(
            readFileSync(join(root, "package.json"), "utf8"),
        ) as Record<string, unknown>;
        expect(pkg.dependencies ?? {}).toEqual({});
        expect(pkg.peerDependencies ?? {}).toEqual({});
        expect(pkg.optionalDependencies ?? {}).toEqual({});
    });

    it("never imports a framework (React, Vue, Angular)", () => {
        const offenders = listFiles(src).filter((file) =>
            IMPORT_FRAMEWORK.test(readFileSync(file, "utf8")),
        );
        expect(offenders).toEqual([]);
    });

    it("has no CSS class names, label defaults or translation", () => {
        const offenders = listFiles(src).filter((file) =>
            FORBIDDEN.test(codeOnly(readFileSync(file, "utf8"))),
        );
        expect(offenders).toEqual([]);
    });

    it("never touches global document, window, observers or frame scheduling: it loads in Node", () => {
        const offenders = listFiles(src).flatMap((file) => {
            const match = GLOBAL_DOM.exec(codeOnly(readFileSync(file, "utf8")));
            return match ? [`${file}: ${match[0]}`] : [];
        });
        expect(offenders).toEqual([]);
    });

    it("never reaches for the global crypto (ids come from an injectable generator)", () => {
        const offenders = listFiles(src).flatMap((file) => {
            const match = GLOBAL_CRYPTO.exec(
                codeOnly(readFileSync(file, "utf8")),
            );
            return match ? [`${file}: ${match[0]}`] : [];
        });
        expect(offenders).toEqual([]);
    });

    it("has no `any` in its exported declarations", () => {
        const offenders = listFiles(src).flatMap((file) =>
            exportedDeclarations(codeOnly(readFileSync(file, "utf8")))
                .filter((declaration) => /\bany\b/.test(declaration))
                .map((declaration) => `${file}: ${declaration.slice(0, 80)}`),
        );
        expect(offenders).toEqual([]);
    });

    it("every file ported from React Complex Tree carries its MIT header", () => {
        const missing = PORTED.filter((file) => {
            const path = join(root, file);
            return (
                !existsSync(path) ||
                !hasUpstreamHeader(readFileSync(path, "utf8"))
            );
        });
        expect(missing).toEqual([]);
    });

    it("reaches the features only through their entries: no folder imports another's code", () => {
        // a feature's folder is imported, as code, only from inside it; the drag features' shared
        // folder (drop-target/) only from theirs. Every other file imports their types (the built
        // entries are checked by scripts/check-features.ts)
        const offenders = listFiles(src).flatMap((file) => {
            const relative = file.slice(src.length + 1);
            const folder = relative.split("/")[0] ?? "";
            const source = readFileSync(file, "utf8");
            return [...source.matchAll(CODE_IMPORT)].flatMap((match) => {
                const target = match[1] ?? "";
                const into = FEATURE_FOLDERS.find((feature) =>
                    target.includes(`/${feature}/`),
                );
                if (into === undefined || into === folder) return [];
                if (into === "drop-target" && DRAG_FOLDERS.includes(folder))
                    return [];
                return [`${relative} -> ${target}`];
            });
        });
        expect(offenders).toEqual([]);
    });

    it("ships the root licence", () => {
        const rootLicence = readFileSync(
            join(root, "..", "..", "LICENSE"),
            "utf8",
        );
        expect(readFileSync(join(root, "LICENSE"), "utf8")).toBe(rootLicence);
    });
});

/** The folders of the features, and the drag features' shared one. */
const DRAG_FOLDERS: readonly string[] = [
    "drag-and-drop",
    "drag-group",
    "foreign-drop",
    "drop-outside",
];
const FEATURE_FOLDERS: readonly string[] = [
    "selection",
    "virtual",
    "checkboxes",
    "rename",
    "async-children",
    "type-ahead",
    ...DRAG_FOLDERS,
    "drop-target",
];
/** An import of code (not `import type`), with its module path. */
const CODE_IMPORT = /^import\s+(?!type\b)[^;]*?from\s+"([^"]*)"/gm;

// The checks above must catch what they are written for: each pattern against a sample.
describe("the guard's own patterns", () => {
    it("detects global DOM access in code but not in comments, strings or through an owner", () => {
        const hits = (code: string) => GLOBAL_DOM.test(codeOnly(code));
        expect(hits("const el = document.createElement('div');")).toBe(true);
        expect(hits("window.addEventListener('x', f);")).toBe(true);
        expect(hits("requestAnimationFrame(() => {});")).toBe(true);
        expect(hits("new ResizeObserver(cb);")).toBe(true);
        expect(
            hits("el.ownerDocument.defaultView.requestAnimationFrame(cb);"),
        ).toBe(false);
        expect(hits('// the window\nconst s = "document";')).toBe(false);
        expect(hits("function f(window: Window) {}")).toBe(false);
    });

    it("detects the global crypto only", () => {
        expect(GLOBAL_CRYPTO.test(codeOnly("crypto.randomUUID()"))).toBe(true);
        expect(GLOBAL_CRYPTO.test(codeOnly("const crypto: X = y;"))).toBe(
            false,
        );
    });

    it("detects a framework import, not a look-alike", () => {
        expect(
            IMPORT_FRAMEWORK.test('import type * as React from "react";'),
        ).toBe(true);
        expect(IMPORT_FRAMEWORK.test('import { h } from "vue";')).toBe(true);
        expect(IMPORT_FRAMEWORK.test('import "react-dom/client";')).toBe(true);
        expect(
            IMPORT_FRAMEWORK.test('import { Component } from "@angular/core";'),
        ).toBe(true);
        expect(IMPORT_FRAMEWORK.test('import { x } from "./reactive";')).toBe(
            false,
        );
    });

    it("detects `any` in an export, not in a local", () => {
        expect(
            exportedDeclarations("export type X = any;\nconst y: any = 1;"),
        ).toEqual(["export type X = any;"]);
    });

    it("detects an import of code, not of types", () => {
        const paths = (code: string) =>
            [...code.matchAll(CODE_IMPORT)].map((match) => match[1]);
        expect(
            paths(
                'import { a } from "../drag-and-drop/x";\nimport type { B } from "../selection/y";',
            ),
        ).toEqual(["../drag-and-drop/x"]);
    });

    it("reads the upstream header", () => {
        expect(
            hasUpstreamHeader(
                "// Ported from React Complex Tree (https://github.com/lukasbach/react-complex-tree).\n// Copyright (c) 2023 Lukas Bach. MIT licence, see LICENSE.\nexport {};\n",
            ),
        ).toBe(true);
        expect(hasUpstreamHeader("export {};\n")).toBe(false);
    });
});
