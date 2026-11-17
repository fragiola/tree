import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { THEMES } from "../src/themes/themes";
import { blend, contrast, oklchToSrgb, parseOklch, type RGB } from "./color";

// The theme contract (DD10): every palette of every theme declares the six
// roles, every theme declares the same palettes and shape tokens, text
// meets WCAG AA on the surfaces it is drawn on, and a theme only sets values:
// it styles no markup, so everything an example looks like is in its own code.

const DIR = join(import.meta.dirname, "../src/themes");
const ROLES = ["base", "soft", "line", "contrast", "accent", "ring"] as const;
const TOKENS = [
    "font",
    "size",
    "radius",
    "row-height",
    "indent",
    "gap",
    "shadow",
    "motion",
    "guide-width",
    "marker",
    "toggle-icon",
    "toggle-closed",
    "toggle-open",
    "toggle-turn",
    "indicator-width",
    "indicator-style",
    "focus-width",
    // per palette: they read the palette the element sits in
    "selected-bg",
    "selected-fg",
    "hover-bg",
    "indicator",
    "marker-color",
    "guide-color",
    "guide",
];
const NEUTRAL = ["surface", "raised"];

type Palettes = Map<string, Map<string, string>>;

function parse(name: string): { palettes: Palettes; tokens: Set<string> } {
    const css = readFileSync(join(DIR, `${name}.css`), "utf-8");
    const palettes: Palettes = new Map();
    const block = new RegExp(
        String.raw`:root \[data-example-theme="${name}"\] \.palette-([a-z-]+),[^{]*\{([^}]*)\}`,
        "g",
    );
    for (const [, palette, body] of css.matchAll(block)) {
        const roles = new Map<string, string>();
        for (const [, role, value] of (body ?? "").matchAll(
            /--palette-([a-z]+):\s*([^;]+);/g,
        )) {
            roles.set(role ?? "", value ?? "");
        }
        palettes.set(palette ?? "", roles);
    }
    const tokens = new Set(
        [...css.matchAll(/--tr-([a-z-]+):/g)].map(([, token]) => token ?? ""),
    );
    return { palettes, tokens };
}

/** Every rule of a theme file: its selectors and the properties it declares. */
function rules(name: string): { selectors: string[]; properties: string[] }[] {
    const css = readFileSync(join(DIR, `${name}.css`), "utf-8").replace(
        /\/\*[\s\S]*?\*\//g,
        "",
    );
    return [...css.matchAll(/([^{}]+)\{([^}]*)\}/g)].map(([, head, body]) => ({
        selectors: (head ?? "")
            .split(",")
            .map((s) => s.trim().replace(/\s+/g, " ")),
        properties: (body ?? "")
            .split(";")
            .map((declaration) => declaration.split(":")[0]?.trim() ?? "")
            .filter(Boolean),
    }));
}

function color(roles: Map<string, string>, role: string): RGB {
    return oklchToSrgb(parseOklch(roles.get(role) ?? ""));
}

const parsed = THEMES.map((theme) => ({ theme, ...parse(theme.name) }));
const reference = parsed[0];

describe.each(parsed)("theme $theme.name", ({ theme, palettes, tokens }) => {
    it("only sets values: custom properties on the theme and on its palettes", () => {
        const scope = `[data-example-theme="${theme.name}"]`;
        const allowed = [
            scope,
            new RegExp(
                String.raw`^:root \[data-example-theme="${theme.name}"\] ?(\.palette-[a-z-]+|\[class\*="palette-"\])$`,
            ),
        ];
        for (const rule of rules(theme.name)) {
            for (const selector of rule.selectors) {
                expect(
                    allowed.some((pattern) =>
                        typeof pattern === "string"
                            ? pattern === selector
                            : pattern.test(selector),
                    ),
                    selector,
                ).toBe(true);
            }
            for (const property of rule.properties) {
                expect(
                    property.startsWith("--") || property === "color-scheme",
                    `${rule.selectors[0]}: ${property}`,
                ).toBe(true);
            }
        }
    });

    it("declares the same palettes as the others", () => {
        expect([...palettes.keys()].sort()).toEqual(
            [...(reference?.palettes.keys() ?? [])].sort(),
        );
        expect(palettes.size).toBeGreaterThanOrEqual(7);
    });

    it("declares all six roles in every palette", () => {
        for (const [palette, roles] of palettes) {
            expect([...roles.keys()].sort(), palette).toEqual(
                [...ROLES].sort(),
            );
        }
    });

    it("declares every shape token", () => {
        expect([...tokens].sort()).toEqual([...TOKENS].sort());
    });

    it("draws contrast text on base at AA (4.5:1) in every palette", () => {
        for (const [palette, roles] of palettes) {
            const ratio = contrast(
                color(roles, "contrast"),
                color(roles, "base"),
            );
            expect(
                ratio,
                `${palette}: contrast on base`,
            ).toBeGreaterThanOrEqual(4.5);
        }
    });

    it("draws secondary text (accent/85) at AA on the neutral surfaces", () => {
        for (const palette of NEUTRAL) {
            const roles = palettes.get(palette);
            expect(roles, palette).toBeDefined();
            if (!roles) continue;
            for (const background of ["base", "soft"]) {
                const bg = color(roles, background);
                const text = blend(color(roles, "accent"), bg, 0.85);
                expect(
                    contrast(text, bg),
                    `${palette}: accent/85 on ${background}`,
                ).toBeGreaterThanOrEqual(4.5);
            }
        }
    });
});

/** The values a theme sets on its own selector (not on its palettes). */
function values(name: string): Map<string, string> {
    const css = readFileSync(join(DIR, `${name}.css`), "utf-8");
    const body =
        css.match(
            new RegExp(
                String.raw`\n\[data-example-theme="${name}"\] \{([^}]*)\}`,
            ),
        )?.[1] ?? "";
    return new Map(
        [...body.matchAll(/--tr-([a-z-]+):\s*([^;]+);/g)].map(
            ([, token, value]) => [token ?? "", (value ?? "").trim()],
        ),
    );
}

describe("the five themes", () => {
    // the engine reads the indentation and the drop line's inset as numbers (the root's
    // `indentation`, 16px, and `indicatorInset`): a theme that changed the indentation or the gap
    // before the icon would put the drops off the rows
    it("share one indentation and one gap: the root's numbers (indentation, indicatorInset) follow them", () => {
        for (const theme of THEMES) {
            expect(values(theme.name).get("indent"), theme.name).toBe("1rem");
            expect(values(theme.name).get("gap"), theme.name).toBe("0.375rem");
        }
    });

    it("are light, dark, ide, paper and terminal, in Dockable's order", () => {
        expect(THEMES.map((theme) => theme.name)).toEqual([
            "light",
            "dark",
            "ide",
            "paper",
            "terminal",
        ]);
    });

    // The examples show that the package is headless: a theme changes the tree's shape, not
    // only its colours.
    it.each(["ide", "paper", "terminal"])(
        "%s differs from light in shape, and in one of the tree's own shapes",
        (name) => {
            const light = values("light");
            const theme = values(name);
            for (const token of ["row-height", "radius", "font"]) {
                expect(theme.get(token), token).not.toBe(light.get(token));
            }
            expect(
                ["guide-width", "marker", "toggle-icon"].some(
                    (token) => theme.get(token) !== light.get(token),
                ),
            ).toBe(true);
        },
    );
});
