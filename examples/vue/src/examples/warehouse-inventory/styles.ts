import { cn } from "#/lib/cn";

// How warehouse-inventory looks: one class string per part, read by the SFCs. Colours
// come from the palette roles and sizes from the theme's --tr-* tokens, so it works in every theme.

export const frame =
    "flex min-h-0 flex-1 flex-col gap-3 p-4 font-(family-name:--tr-font) text-(length:--tr-size) text-palette-contrast";

export const toolbar = "flex flex-wrap items-center gap-2";

export const select =
    "h-8 min-w-0 rounded-(--tr-radius) border border-palette-line bg-palette-base px-2 text-palette-contrast text-sm outline-none focus-visible:border-palette-ring";

export const lowCount =
    "palette-orange ms-auto flex items-center gap-1.5 text-palette-accent text-sm [&_svg]:size-4";

export const body = "flex min-h-0 flex-1 flex-col gap-3 md:flex-row";

/**
 * The scroll container the virtualizer measures (its height comes from the frame), and the drop
 * indicator's containing block.
 */
export const root =
    "palette-raised min-h-0 flex-1 overflow-auto rounded-(--tr-radius) border border-palette-line bg-palette-base p-1 shadow-(--tr-shadow) data-dragging:cursor-grabbing max-md:min-h-64 md:w-80 md:flex-none";

/** The item is the row the virtualizer measures: no margin. A zone highlight dims the others. */
export const item = "outline-none transition-opacity data-dimmed:opacity-40";

/** The indentation is the depth every part carries, `--tree-depth`, times the theme's indent. */
export const row = cn(
    "flex h-(--tr-row-height) cursor-default select-none items-center gap-(--tr-gap) rounded-(--tr-radius) pe-2",
    "ps-[calc(var(--tree-depth)*var(--tr-indent)+0.25rem)] hover:bg-(--tr-hover-bg)",
    // the theme's indentation guides: one line per level, under each ancestor's toggle
    "bg-(image:--tr-guide) bg-size-[calc(var(--tree-depth)*var(--tr-indent))_100%] bg-no-repeat",
    "bg-position-[calc(0.75rem-var(--tr-indent)/2)_0] rtl:bg-position-[right_calc(0.75rem-var(--tr-indent)/2)_top]",
    "[:focus-visible>&]:ring-(length:--tr-focus-width) [:focus-visible>&]:ring-palette-ring [:focus-visible>&]:ring-inset",
    "data-selected:bg-(--tr-selected-bg) data-selected:text-(--tr-selected-fg)",
    // the theme's marker: a bar at the inline start of a selected row (0px: none), out of the layout
    "relative before:absolute before:inset-y-0 before:start-0 before:w-(--tr-marker) before:rounded-full data-selected:before:bg-(--tr-marker-color)",
    "data-dragging:opacity-45",
);

export const toggle = cn(
    "flex size-4 shrink-0 items-center justify-center text-palette-accent/85 transition-[rotate] duration-(--tr-motion) data-leaf:invisible [&_svg]:size-3.5",
    // the theme's toggle: the chevron (or none), or a text drawn instead ("+" and "-")
    "[&_svg]:[display:var(--tr-toggle-icon)] before:content-(--tr-toggle-closed) data-expanded:before:content-(--tr-toggle-open)",
    "data-expanded:rotate-(--tr-toggle-turn) rtl:-scale-x-100 rtl:data-expanded:-rotate-(--tr-toggle-turn)",
);

/** The locations are quiet; the site stands out. */
export const icon = {
    site: "palette-blue size-4 shrink-0 text-palette-accent",
    location: "size-4 shrink-0 text-palette-accent/85",
} as const;

/** A climate's colour, on a zone and on the products that need it (a palette is a class). */
export const climate = {
    ambient: "palette-orange size-4 shrink-0 text-palette-accent",
    cold: "palette-blue size-4 shrink-0 text-palette-accent",
    frozen: "palette-purple size-4 shrink-0 text-palette-accent",
    hazmat: "palette-danger size-4 shrink-0 text-palette-accent",
    returns: "palette-green size-4 shrink-0 text-palette-accent",
} as const;

export const label = "min-w-0 flex-1 truncate";

/** The units under an item: secondary, aligned figures. */
export const units = "shrink-0 text-palette-accent/85 text-xs tabular-nums";

/** A bin's fill: a track, and a bar whose colour says how full it is. */
export const fill =
    "h-1.5 w-16 shrink-0 overflow-hidden rounded-full bg-palette-line";

export const fillBar = (ratio: number) =>
    cn(
        "block h-full rounded-full bg-palette-accent",
        ratio >= 0.9
            ? "palette-danger"
            : ratio >= 0.6
              ? "palette-orange"
              : "palette-green",
    );

/** Low stock: a warning, with the count on a location. */
export const low =
    "palette-orange flex shrink-0 items-center gap-0.5 text-palette-accent text-xs tabular-nums [&_svg]:size-3.5";

/** Where a drop line starts past its level (px), drag and drop's `indicatorInset`: past the root's and
 * the row's padding (4px each), the toggle (16px) and the gap (6px), at the icon. */
export const indicatorInset = 30;

/** A line before or after a row (from the icon), the row's box inside a bin. */
export const dropIndicator = cn(
    "pointer-events-none z-10",
    "data-[drop-position=before]:-mt-px data-[drop-position=before]:border-t-(length:--tr-indicator-width) data-[drop-position=before]:[border-top-style:var(--tr-indicator-style)] data-[drop-position=before]:border-(--tr-indicator)",
    "data-[drop-position=after]:-mt-px data-[drop-position=after]:border-t-(length:--tr-indicator-width) data-[drop-position=after]:[border-top-style:var(--tr-indicator-style)] data-[drop-position=after]:border-(--tr-indicator)",
    "data-[drop-position=inside]:rounded-(--tr-radius) data-[drop-position=inside]:border-(length:--tr-indicator-width) data-[drop-position=inside]:[border-style:var(--tr-indicator-style)] data-[drop-position=inside]:border-(--tr-indicator)",
);

export const liveRegion = "sr-only";

/** The details panel, beside the tree: it takes the width the tree leaves. */
export const details =
    "palette-raised flex shrink-0 flex-col gap-3 overflow-auto rounded-(--tr-radius) border border-palette-line bg-palette-base p-4 shadow-(--tr-shadow) md:min-w-72 md:flex-1";

export const empty = "m-auto text-center text-palette-accent/85";

export const path = "m-0 truncate text-palette-accent/85 text-xs";

export const title = "m-0 font-semibold text-base";

export const facts = "m-0 grid gap-2";

export const fact = "flex items-baseline justify-between gap-3";

export const term = "text-palette-accent/85 text-xs";

export const value = "m-0 text-end tabular-nums";

export const form = "flex flex-col gap-1.5";

export const formRow = "flex gap-2 [&>select]:flex-1";

export const input =
    "h-8 w-24 min-w-0 rounded-(--tr-radius) border border-palette-line bg-palette-base px-2 text-palette-contrast tabular-nums outline-none focus-visible:border-palette-ring";

export const notice = "m-0 min-h-5 text-palette-accent/85 text-sm";
