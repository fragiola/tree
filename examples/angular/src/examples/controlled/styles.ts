import { cn } from "#/lib/cn";

// How controlled looks: one class string per part, read by the component. Colours come from the
// palette roles and sizes from the theme's --tr-* tokens, so it works in every theme.

export const frame =
    "flex min-h-0 flex-1 flex-col gap-3 p-4 font-(family-name:--tr-font) text-(length:--tr-size)";

export const toolbar = "flex flex-wrap items-center gap-2";

export const switchField =
    "ms-auto flex items-center gap-2 text-palette-accent text-sm";

export const body = "flex min-h-0 flex-1 flex-col gap-3 sm:flex-row";

export const root =
    "palette-raised min-h-0 flex-1 overflow-auto rounded-(--tr-radius) border border-palette-line bg-palette-base p-1 text-palette-contrast shadow-(--tr-shadow)";

export const item = "outline-none";

export const row = cn(
    "flex h-(--tr-row-height) cursor-default select-none items-center gap-(--tr-gap) rounded-(--tr-radius) pe-2",
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

export const label = "truncate";

/** The app's state, printed as the JSON the tree receives. */
export const state =
    "palette-raised flex shrink-0 flex-col gap-1.5 overflow-auto rounded-(--tr-radius) border border-palette-line bg-palette-base p-3 text-palette-contrast sm:w-64";

export const stateTitle =
    "font-medium font-mono text-palette-accent/85 text-xs";

export const stateValue =
    "mb-1.5 block break-all rounded-[4px] bg-palette-soft px-1.5 py-1 font-mono text-palette-contrast text-xs";

export const stateNote = "text-palette-accent/85 text-xs";
