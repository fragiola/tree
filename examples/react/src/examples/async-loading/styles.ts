import { cn } from "#/lib/cn";

// How async-loading looks: one class string per part, read by index.tsx. Colours come from the
// palette roles and sizes from the theme's --tr-* tokens, so it works in every theme.

export const frame =
    "flex min-h-0 flex-1 flex-col gap-3 p-4 font-(family-name:--tr-font) text-(length:--tr-size)";

export const hint = "text-palette-accent/85 text-sm";

export const root =
    "palette-raised min-h-0 flex-1 overflow-auto rounded-(--tr-radius) border border-palette-line bg-palette-base p-1 text-palette-contrast shadow-(--tr-shadow)";

export const item = "outline-none";

/** A row: indented by its depth, selected and focused through its own data-* state. */
export const row = cn(
    "flex h-(--tr-row-height) cursor-default select-none items-center gap-(--tr-gap) rounded-(--tr-radius) pe-1",
    "ps-[calc(var(--tree-depth)*var(--tr-indent)+0.25rem)] hover:bg-(--tr-hover-bg)",
    "[:focus-visible>&]:ring-2 [:focus-visible>&]:ring-palette-ring [:focus-visible>&]:ring-inset",
    "data-selected:bg-(--tr-selected-bg) data-selected:text-(--tr-selected-fg)",
);

export const toggle = cn(
    "flex size-4 shrink-0 items-center justify-center text-palette-accent/85 transition-[rotate] duration-(--tr-motion) data-leaf:invisible [&_svg]:size-3.5",
    "data-expanded:rotate-90 rtl:-scale-x-100 rtl:data-expanded:-rotate-90",
);

export const folderIcon = "palette-blue size-4 shrink-0 text-palette-accent";

export const fileIcon = "size-4 shrink-0 text-palette-accent/85";

export const label = "min-w-0 flex-1 truncate";

export const size = "shrink-0 text-palette-accent/85 text-xs tabular-nums";

export const spinner =
    "size-4 shrink-0 animate-spin text-palette-accent/85 motion-reduce:animate-none";

export const error =
    "palette-danger flex shrink-0 items-center gap-1 text-palette-accent";

export const errorIcon = "size-4";

export const retry = "h-6 gap-1 px-2 text-palette-accent text-xs";

/** Read by screen readers, never seen. */
export const liveRegion = "sr-only";
