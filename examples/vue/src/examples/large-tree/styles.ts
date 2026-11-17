import { cn } from "#/lib/cn";

// How large-tree looks: one class string per part, read by the SFCs. Colours come from the
// palette roles and sizes from the theme's --tr-* tokens, so it works in every theme: the rows are
// measured, so each theme's row height is the virtualizer's too.

export const frame =
    "flex min-h-0 flex-1 flex-col gap-3 p-4 font-(family-name:--tr-font) text-(length:--tr-size)";

export const toolbar = "flex flex-wrap items-center gap-2";

export const count = "ms-auto text-palette-accent/85 text-sm tabular-nums";

/**
 * The root is the scroll element the virtualizer follows (`overflow-auto`, a height from the
 * frame), and the drop indicator's containing block (the package makes it `relative`).
 */
export const root =
    "palette-raised min-h-0 flex-1 overflow-auto rounded-(--tr-radius) border border-palette-line bg-palette-base p-1 text-palette-contrast shadow-(--tr-shadow) data-dragging:cursor-grabbing";

/** The item is the row the virtualizer measures: no margin, its height is the row's. */
export const item = "outline-none";

/**
 * A flat row: no group holds it, its indentation is its depth (`--tree-depth`) times the theme's
 * indent. The dragged rows fade, and a folder the drop would go into is tinted.
 */
export const row = cn(
    "flex h-(--tr-row-height) cursor-grab select-none items-center gap-(--tr-gap) rounded-(--tr-radius) pe-2",
    "ps-[calc(var(--tree-depth)*var(--tr-indent)+0.25rem)] hover:bg-(--tr-hover-bg)",
    // the theme's indentation guides: one line per level, under each ancestor's toggle
    "bg-(image:--tr-guide) bg-size-[calc(var(--tree-depth)*var(--tr-indent))_100%] bg-no-repeat",
    "bg-position-[calc(0.75rem-var(--tr-indent)/2)_0] rtl:bg-position-[right_calc(0.75rem-var(--tr-indent)/2)_top]",
    "[:focus-visible>&]:ring-(length:--tr-focus-width) [:focus-visible>&]:ring-palette-ring [:focus-visible>&]:ring-inset",
    "data-selected:bg-(--tr-selected-bg) data-selected:text-(--tr-selected-fg)",
    // the theme's marker: a bar at the inline start of a selected row (0px: none), out of the layout
    "relative before:absolute before:inset-y-0 before:start-0 before:w-(--tr-marker) before:rounded-full data-selected:before:bg-(--tr-marker-color)",
    "data-dragging:opacity-45",
    "data-[drop-position=inside]:bg-(--tr-hover-bg)",
);

export const toggle = cn(
    "flex size-4 shrink-0 items-center justify-center text-palette-accent/85 transition-[rotate] duration-(--tr-motion) data-leaf:invisible [&_svg]:size-3.5",
    // the theme's toggle: the chevron (or none), or a text drawn instead ("+" and "-")
    "[&_svg]:[display:var(--tr-toggle-icon)] before:content-(--tr-toggle-closed) data-expanded:before:content-(--tr-toggle-open)",
    "data-expanded:rotate-(--tr-toggle-turn) rtl:-scale-x-100 rtl:data-expanded:-rotate-(--tr-toggle-turn)",
);

export const folderIcon = "palette-blue size-4 shrink-0 text-palette-accent";

export const fileIcon = "size-4 shrink-0 text-palette-accent/85";

export const label = "min-w-0 flex-1 truncate";

/** Where a drop line starts past its level (px), the root's `indicatorInset`: past the root's and
 * the row's padding (4px each), the toggle (16px) and the gap (6px), at the icon. */
export const indicatorInset = 30;

/**
 * The package positions the indicator (absolute, from the inline start of the target's level, past
 * the toggle by `indicatorInset`) and gives a line no height: before and after draw a line with a
 * dot at its start, at the icon; inside outlines the row.
 */
export const dropIndicator = cn(
    "pointer-events-none z-10",
    "data-[drop-position=before]:-mt-px data-[drop-position=before]:border-t-(length:--tr-indicator-width) data-[drop-position=before]:[border-top-style:var(--tr-indicator-style)] data-[drop-position=before]:border-(--tr-indicator)",
    "data-[drop-position=after]:-mt-px data-[drop-position=after]:border-t-(length:--tr-indicator-width) data-[drop-position=after]:[border-top-style:var(--tr-indicator-style)] data-[drop-position=after]:border-(--tr-indicator)",
    "before:absolute before:-start-1 before:-top-[4px] before:size-1.5 before:rounded-full before:border-2 before:border-(--tr-indicator) before:bg-palette-base",
    "data-[drop-position=inside]:rounded-(--tr-radius) data-[drop-position=inside]:border-(length:--tr-indicator-width) data-[drop-position=inside]:[border-style:var(--tr-indicator-style)] data-[drop-position=inside]:border-(--tr-indicator) data-[drop-position=inside]:before:hidden",
);

export const liveRegion = "sr-only";

export const hint = "text-palette-accent/85 text-sm";
