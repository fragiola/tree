import { cn } from "#/lib/cn";

// How keyboard looks: one class string per part, read by index.tsx. Colours come from the
// palette roles and sizes from the theme's --tr-* tokens, so it works in every theme.

export const frame =
    "flex min-h-0 flex-1 flex-col gap-3 overflow-auto p-4 font-(family-name:--tr-font) text-(length:--tr-size) sm:flex-row sm:overflow-hidden";

export const treeColumn = "flex min-h-48 min-w-0 flex-1 flex-col";

export const root =
    "palette-raised flex min-h-0 flex-1 flex-col overflow-auto rounded-(--tr-radius) border border-palette-line bg-palette-base p-1 text-palette-contrast shadow-(--tr-shadow)";

export const item = "outline-none";

export const row = cn(
    "flex h-(--tr-row-height) cursor-default select-none items-center gap-(--tr-gap) rounded-(--tr-radius) pe-1",
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

export const folderIcon = "palette-blue size-4 shrink-0 text-palette-accent";

export const fileIcon = "size-4 shrink-0 text-palette-accent/85";

export const label = "min-w-0 truncate [[data-renaming]>&]:hidden";

export const input =
    "h-[calc(var(--tr-row-height)-6px)] min-w-0 flex-1 rounded-[4px] border border-palette-line bg-palette-base px-1.5 text-palette-contrast outline-none focus:border-palette-ring";

/** Where a drop line starts past its level (px), drag and drop's `indicatorInset`: past the root's and
 * the row's padding (4px each), the toggle (16px) and the gap (6px), at the icon. */
export const indicatorInset = 30;

/** A line before or after a row (from the icon), the row's box inside a folder. */
export const dropIndicator = cn(
    "pointer-events-none z-10",
    "data-[drop-position=before]:-mt-px data-[drop-position=before]:border-t-(length:--tr-indicator-width) data-[drop-position=before]:[border-top-style:var(--tr-indicator-style)] data-[drop-position=before]:border-(--tr-indicator)",
    "data-[drop-position=after]:-mt-px data-[drop-position=after]:border-t-(length:--tr-indicator-width) data-[drop-position=after]:[border-top-style:var(--tr-indicator-style)] data-[drop-position=after]:border-(--tr-indicator)",
    "data-[drop-position=inside]:rounded-(--tr-radius) data-[drop-position=inside]:border-(length:--tr-indicator-width) data-[drop-position=inside]:[border-style:var(--tr-indicator-style)] data-[drop-position=inside]:border-(--tr-indicator)",
);

/** The live region, shown at the bottom of the tree while it has something to say. */
export const liveRegion =
    "sticky bottom-0 mt-auto rounded-(--tr-radius) border border-palette-line bg-palette-soft px-2 py-1.5 text-palette-accent text-xs empty:hidden";

export const legend =
    "palette-raised flex shrink-0 flex-col gap-2 overflow-auto rounded-(--tr-radius) border border-palette-line bg-palette-base p-3 text-palette-contrast sm:w-80";

export const legendTitle =
    "font-medium text-palette-accent/85 text-xs uppercase tracking-wide";

export const keyList = "flex flex-col gap-1.5";

export const keyRow = "flex items-baseline gap-2";

export const keys = "flex w-32 shrink-0 flex-wrap items-center gap-0.5";

export const kbd =
    "min-w-5 rounded-[4px] border border-palette-line border-b-2 bg-palette-soft px-1 text-center font-mono text-palette-contrast text-xs";

export const plus = "text-palette-accent/85 text-xs";

export const does = "text-palette-accent/85 text-xs";
