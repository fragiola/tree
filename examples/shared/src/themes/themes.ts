// The example themes, in switcher order. Each has a CSS file next to this one.
// Generated once from the palettes below and then edited by hand; the CSS is the source.

export const THEMES = [
    {
        name: "light",
        title: "Light",
        description: "Neutral and quiet: the reference look.",
        scheme: "light",
        swatch: [
            "oklch(0.96 0.003 250)",
            "oklch(1 0 0)",
            "oklch(0.55 0.2 250)",
            "oklch(0.68 0.17 55)",
        ],
    },
    {
        name: "dark",
        title: "Dark",
        description: "The same shapes as Light, on dark palettes.",
        scheme: "dark",
        swatch: [
            "oklch(0.13 0.01 250)",
            "oklch(0.19 0.01 250)",
            "oklch(0.7 0.18 250)",
            "oklch(0.75 0.16 55)",
        ],
    },
] as const;

export type ThemeName = (typeof THEMES)[number]["name"];

export const DEFAULT_THEME: ThemeName = "light";

export function isThemeName(value: unknown): value is ThemeName {
    return THEMES.some((theme) => theme.name === value);
}
