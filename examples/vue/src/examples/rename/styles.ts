import { cn } from "#/lib/cn";

// How rename looks: one class string per part, read by the SFCs. Colours come from the
// palette roles and sizes from the theme's --tr-* tokens, so it works in every theme.

export const frame =
    "flex min-h-0 flex-1 flex-col gap-3 p-4 font-(family-name:--tr-font) text-(length:--tr-size)";

export const hint = "text-palette-accent/85 text-sm";

export const kbd =
    "rounded-[4px] border border-palette-line bg-palette-soft px-1 py-px font-mono text-palette-contrast text-xs";

export const root =
    "palette-raised min-h-0 flex-1 overflow-auto rounded-(--tr-radius) border border-palette-line bg-palette-base p-1 text-palette-contrast shadow-(--tr-shadow)";

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
    "data-renaming:hover:bg-transparent",
);

export const toggle = cn(
    "flex size-4 shrink-0 items-center justify-center text-palette-accent/85 transition-[rotate] duration-(--tr-motion) data-leaf:invisible [&_svg]:size-3.5",
    // the theme's toggle: the chevron (or none), or a text drawn instead ("+" and "-")
    "[&_svg]:[display:var(--tr-toggle-icon)] before:content-(--tr-toggle-closed) data-expanded:before:content-(--tr-toggle-open)",
    "data-expanded:rotate-(--tr-toggle-turn) rtl:-scale-x-100 rtl:data-expanded:-rotate-(--tr-toggle-turn)",
);

/** The row's own `data-expanded` picks the folder's icon (the row is the icons' parent). */
export const folderClosed =
    "palette-blue size-4 shrink-0 text-palette-accent [[data-expanded]>&]:hidden";

export const folderOpen =
    "palette-blue hidden size-4 shrink-0 text-palette-accent [[data-expanded]>&]:block";

export const fileIcon = "size-4 shrink-0 text-palette-accent/85";

/** The label gives its place to the input while its row is renaming. */
export const label = "min-w-0 truncate [[data-renaming]>&]:hidden";

/** A refused label turns the input's border to the danger palette (`data-invalid`). */
export const input = cn(
    "h-[calc(var(--tr-row-height)-6px)] min-w-0 flex-1 rounded-[4px] border border-palette-line bg-palette-base px-1.5 text-palette-contrast outline-none",
    "focus:border-palette-ring focus:ring-2 focus:ring-palette-ring/30",
    // `[data-invalid]` takes the danger palette by itself (palettes/danger.css)
    "data-invalid:border-palette-accent data-invalid:bg-palette-soft data-invalid:text-palette-accent data-invalid:ring-palette-accent/30",
);

/** The reason a name was refused; empty (and still announced when it fills) otherwise. */
export const error = "palette-danger min-h-5 text-palette-accent text-sm";
