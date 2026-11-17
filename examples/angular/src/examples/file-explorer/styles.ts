import { cn } from "#/lib/cn";

// How file-explorer looks: one class string per part, read by the components. Colours come from the
// palette roles and sizes from the theme's --tr-* tokens, so it works in every theme.

export const frame = "flex min-h-0 flex-1 flex-col p-4";

export const root =
    "palette-raised min-h-0 flex-1 overflow-auto rounded-(--tr-radius) border border-palette-line bg-palette-base p-1 font-(family-name:--tr-font) text-(length:--tr-size) text-palette-contrast shadow-(--tr-shadow)";

/** The item is the element that takes focus: its ring is drawn on its own row (`[:focus-visible>&]`). */
export const item = "outline-none";

/** The indentation is the depth every part carries, `--tree-depth`, times the theme's indent. */
export const row = cn(
    "flex h-(--tr-row-height) cursor-default select-none items-center gap-(--tr-gap) rounded-(--tr-radius) pe-2",
    "ps-[calc(var(--tree-depth)*var(--tr-indent)+0.25rem)] hover:bg-(--tr-hover-bg)",
    // the theme's indentation guides: one line per level, under each ancestor's toggle
    "bg-(image:--tr-guide) bg-size-[calc(var(--tree-depth)*var(--tr-indent))_100%] bg-no-repeat",
    "bg-position-[calc(0.75rem-var(--tr-indent)/2)_0] rtl:bg-position-[right_calc(0.75rem-var(--tr-indent)/2)_top]",
    "[:focus-visible>&]:ring-(length:--tr-focus-width) [:focus-visible>&]:ring-palette-ring [:focus-visible>&]:ring-inset",
    "data-selected:bg-(--tr-selected-bg) data-selected:text-(--tr-selected-fg)",
    // the theme's marker: a line at the inline start of a selected row (0px: none)
    "border-s-(length:--tr-marker) border-transparent data-selected:border-(--tr-marker-color)",
);

export const toggle = cn(
    "flex size-4 shrink-0 items-center justify-center text-palette-accent/85 transition-[rotate] duration-(--tr-motion) data-leaf:invisible [&_svg]:size-3.5",
    // the theme's toggle: the chevron (or none), or a text drawn instead ("+" and "-")
    "[&_svg]:[display:var(--tr-toggle-icon)] before:content-(--tr-toggle-closed) data-expanded:before:content-(--tr-toggle-open)",
    "data-expanded:rotate-(--tr-toggle-turn) rtl:-scale-x-100 rtl:data-expanded:-rotate-(--tr-toggle-turn)",
);

/** Folders take the blue palette's accent; files stay quiet. */
export const folderIcon = "palette-blue size-4 shrink-0 text-palette-accent";

export const fileIcon = "size-4 shrink-0 text-palette-accent/85";

export const label = "min-w-0 flex-1 truncate";

/** The size: secondary, aligned figures, pushed to the row's end. */
export const size = "shrink-0 text-palette-accent/85 text-xs tabular-nums";
