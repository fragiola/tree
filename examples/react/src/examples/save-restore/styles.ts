import { cn } from "#/lib/cn";

// How save-restore looks: one class string per part, read by index.tsx. Colours come from the
// palette roles and sizes from the theme's --tr-* tokens, so it works in every theme.

export const frame =
    "flex min-h-0 flex-1 flex-col gap-3 p-4 font-(family-name:--tr-font) text-(length:--tr-size)";

export const toolbar = "flex flex-wrap items-center gap-2";

/** A dot before the status: green once the tree is saved, quiet before. */
export const status = (saved: boolean) =>
    cn(
        "me-auto flex items-center gap-1.5 text-palette-accent text-sm before:size-2 before:rounded-full before:bg-palette-line",
        saved && "palette-green before:bg-palette-base",
    );
("palette-green me-auto flex items-center gap-1.5 text-palette-accent text-sm before:size-2 before:rounded-full before:bg-palette-base");

export const root =
    "palette-raised min-h-0 flex-1 overflow-auto rounded-(--tr-radius) border border-palette-line bg-palette-base p-1 text-palette-contrast shadow-(--tr-shadow)";

export const item = "outline-none";

export const row = cn(
    "flex h-(--tr-row-height) cursor-default select-none items-center gap-(--tr-gap) rounded-(--tr-radius) pe-1",
    "ps-[calc(var(--tree-depth)*var(--tr-indent)+0.25rem)] hover:bg-(--tr-hover-bg)",
    "[:focus-visible>&]:ring-2 [:focus-visible>&]:ring-palette-ring [:focus-visible>&]:ring-inset",
    "data-selected:bg-(--tr-selected-bg) data-selected:text-(--tr-selected-fg)",
    "data-dragging:opacity-45",
);

export const toggle = cn(
    "flex size-4 shrink-0 items-center justify-center text-palette-accent/85 transition-[rotate] duration-(--tr-motion) data-leaf:invisible [&_svg]:size-3.5",
    "data-expanded:rotate-90 rtl:-scale-x-100 rtl:data-expanded:-rotate-90",
);

export const folderIcon = "palette-blue size-4 shrink-0 text-palette-accent";

export const fileIcon = "size-4 shrink-0 text-palette-accent/85";

export const label = "min-w-0 truncate [[data-renaming]>&]:hidden";

export const input =
    "h-[calc(var(--tr-row-height)-6px)] min-w-0 flex-1 rounded-[4px] border border-palette-line bg-palette-base px-1.5 text-palette-contrast outline-none focus:border-palette-ring";

/** The line starts at the icon, past the toggle (the package places it at the level's start). */
export const dropIndicator = cn(
    "pointer-events-none z-10 ms-7 data-[drop-position=inside]:ms-0",
    "data-[drop-position=before]:-mt-px data-[drop-position=before]:border-t-2 data-[drop-position=before]:border-(--tr-indicator)",
    "data-[drop-position=after]:-mt-px data-[drop-position=after]:border-t-2 data-[drop-position=after]:border-(--tr-indicator)",
    "data-[drop-position=inside]:rounded-(--tr-radius) data-[drop-position=inside]:border-2 data-[drop-position=inside]:border-(--tr-indicator)",
);

export const hint = "text-palette-accent/85 text-sm";
