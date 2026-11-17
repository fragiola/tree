import { cn } from "#/lib/cn";

// How drag-and-drop looks: one class string per part, read by the component. Colours come from the
// palette roles and sizes from the theme's --tr-* tokens, so it works in every theme.

export const frame =
    "flex min-h-0 flex-1 flex-col gap-3 p-4 font-(family-name:--tr-font) text-(length:--tr-size)";

/** The root is the drop indicator's containing block (the package makes it `relative`). */
export const root =
    "palette-raised min-h-0 flex-1 overflow-auto rounded-(--tr-radius) border border-palette-line bg-palette-base p-1 text-palette-contrast shadow-(--tr-shadow) data-dragging:cursor-grabbing";

export const item = "outline-none";

/**
 * The row's own drag state: the dragged rows fade, and a folder the drop would go into is
 * tinted (a line before or after a row is the indicator's).
 */
export const row = cn(
    "group/row flex h-(--tr-row-height) cursor-grab select-none items-center gap-(--tr-gap) rounded-(--tr-radius) pe-2",
    "ps-[calc(var(--tree-depth)*var(--tr-indent)+0.25rem)] hover:bg-(--tr-hover-bg)",
    // the theme's indentation guides: one line per level, under each ancestor's toggle
    "bg-(image:--tr-guide) bg-size-[calc(var(--tree-depth)*var(--tr-indent))_100%] bg-no-repeat",
    "bg-position-[calc(1.5rem+var(--tr-gap)-var(--tr-indent)/2)_0] rtl:bg-position-[right_calc(1.5rem+var(--tr-gap)-var(--tr-indent)/2)_top]",
    "[:focus-visible>&]:ring-(length:--tr-focus-width) [:focus-visible>&]:ring-palette-ring [:focus-visible>&]:ring-inset",
    "data-selected:bg-(--tr-selected-bg) data-selected:text-(--tr-selected-fg)",
    // the theme's marker: a line at the inline start of a selected row (0px: none)
    "border-s-(length:--tr-marker) border-transparent data-selected:border-(--tr-marker-color)",
    "data-dragging:opacity-45",
    "data-[drop-position=inside]:bg-(--tr-hover-bg)",
);

/** A grip that shows on hover: the row is the handle. */
export const grip =
    "-ms-0.5 size-3.5 shrink-0 text-palette-accent/85 opacity-0 transition-opacity duration-(--tr-motion) group-hover/row:opacity-100";

export const toggle = cn(
    "flex size-4 shrink-0 items-center justify-center text-palette-accent/85 transition-[rotate] duration-(--tr-motion) data-leaf:invisible [&_svg]:size-3.5",
    // the theme's toggle: the chevron (or none), or a text drawn instead ("+" and "-")
    "[&_svg]:[display:var(--tr-toggle-icon)] before:content-(--tr-toggle-closed) data-expanded:before:content-(--tr-toggle-open)",
    "data-expanded:rotate-(--tr-toggle-turn) rtl:-scale-x-100 rtl:data-expanded:-rotate-(--tr-toggle-turn)",
);

export const folderIcon = "palette-blue size-4 shrink-0 text-palette-accent";

export const fileIcon = "size-4 shrink-0 text-palette-accent/85";

export const label = "min-w-0 flex-1 truncate";

export const lock = "size-3.5 shrink-0 text-palette-accent/85";

/**
 * The package positions the indicator (absolute, from the inline start of the target's level) and
 * gives a line no height: before and after draw a 2px line with a dot at its start, moved past the
 * grip and the toggle to start at the icon; inside outlines the row.
 */
export const dropIndicator = cn(
    "pointer-events-none z-10 ms-11 data-[drop-position=inside]:ms-0",
    "data-[drop-position=before]:-mt-px data-[drop-position=before]:border-t-(length:--tr-indicator-width) data-[drop-position=before]:[border-top-style:var(--tr-indicator-style)] data-[drop-position=before]:border-(--tr-indicator)",
    "data-[drop-position=after]:-mt-px data-[drop-position=after]:border-t-(length:--tr-indicator-width) data-[drop-position=after]:[border-top-style:var(--tr-indicator-style)] data-[drop-position=after]:border-(--tr-indicator)",
    "before:absolute before:-start-1 before:-top-[4px] before:size-1.5 before:rounded-full before:border-2 before:border-(--tr-indicator) before:bg-palette-base",
    "data-[drop-position=inside]:rounded-(--tr-radius) data-[drop-position=inside]:border-(length:--tr-indicator-width) data-[drop-position=inside]:[border-style:var(--tr-indicator-style)] data-[drop-position=inside]:border-(--tr-indicator) data-[drop-position=inside]:before:hidden",
);

export const liveRegion = "sr-only";

export const hint = "text-palette-accent/85 text-sm";

export const hintIcon = "inline size-3.5 align-[-2px]";
