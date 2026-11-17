import { readdirSync, readFileSync, statSync } from "node:fs";
import { join, relative } from "node:path";
import { describe, expect, it } from "vitest";

// The Fragiola UI theme (the palettes, the base stylesheet) and `cn` are vendored into
// examples/react by its scripts/vendor-fragiola.ts; this app copies them, so the Angular kit
// (src/components, ported from Dockable's Angular kit) wears the React kit's classes. A copy is the
// original with its first line (the vendoring header) replaced.

const here = join(import.meta.dirname, "..");
const react = join(here, "..", "react");

function listFiles(dir: string): string[] {
    return readdirSync(dir).flatMap((name) => {
        const path = join(dir, name);
        return statSync(path).isDirectory() ? listFiles(path) : [path];
    });
}

const COPIES = [
    ...listFiles(join(here, "src/styles")),
    join(here, "src/lib/cn.ts"),
];

const body = (source: string) => source.slice(source.indexOf("\n") + 1);

describe("the files copied from examples/react", () => {
    it.each(COPIES.map((file) => relative(here, file)))("%s", (file) => {
        const copy = readFileSync(join(here, file), "utf8");
        const original = readFileSync(join(react, file), "utf8");
        expect(copy.split("\n")[0]).toContain(
            `Copied from examples/react/${file}`,
        );
        expect(body(copy)).toBe(body(original));
    });

    it("cover every palette examples/react vendors", () => {
        const names = (dir: string) => readdirSync(dir).sort();
        expect(names(join(here, "src/styles/palettes"))).toEqual(
            names(join(react, "src/styles/palettes")),
        );
    });

    it("leave the Angular kit the React kit's components and their classes", () => {
        const kit = (name: string) =>
            readFileSync(join(here, "src/components", name), "utf8");
        // the clickable atom and the switch, as React's (the same `tv` strings)
        const clickable = readFileSync(
            join(react, "src/components/atoms/clickable/index.tsx"),
            "utf8",
        );
        for (const variant of ["ghost", "outline", "solid"]) {
            const line = clickable
                .split("\n")
                .find((text) => text.trim().startsWith(`${variant}:`));
            expect(line, variant).toBeDefined();
            expect(kit("atoms/clickable.ts")).toContain(line?.trim() ?? "");
        }
        const toggle = "bg-palette-soft data-checked:bg-palette-ring";
        expect(
            readFileSync(join(react, "src/components/ui/switch.tsx"), "utf8"),
        ).toContain(toggle);
        expect(kit("ui/switch.ts")).toContain(toggle);
    });
});
