import { cn } from "#/lib/cn";

// How hello-tree looks: one class string per part, read by the component. Colours come from the
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
    "[:focus-visible>&]:ring-2 [:focus-visible>&]:ring-palette-ring [:focus-visible>&]:ring-inset",
    // the row carries its item's state too: no ancestor's state leaks into a nested row
    "data-selected:bg-(--tr-selected-bg) data-selected:text-(--tr-selected-fg)",
);

/** A leaf keeps its toggle's room, so labels line up; the chevron turns down when expanded (in
 * right-to-left it points the other way, then turns the other way). */
export const toggle = cn(
    "flex size-4 shrink-0 items-center justify-center text-palette-accent/85 transition-[rotate] duration-(--tr-motion) data-leaf:invisible [&_svg]:size-3.5",
    "data-expanded:rotate-90 rtl:-scale-x-100 rtl:data-expanded:-rotate-90",
);

export const label = "truncate";
