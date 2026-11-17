import { cn } from "#/lib/cn";

// How command-console looks: one class string per part, read by index.tsx. Colours come from the
// palette roles and sizes from the theme's --tr-* tokens, so it works in every theme.

export const frame =
    "flex min-h-0 flex-1 flex-col gap-3 overflow-auto p-4 font-(family-name:--tr-font) text-(length:--tr-size) sm:flex-row sm:overflow-hidden";

export const root =
    "palette-raised min-h-40 flex-1 overflow-auto rounded-(--tr-radius) border border-palette-line bg-palette-base p-1 text-palette-contrast shadow-(--tr-shadow) sm:min-h-0 sm:max-w-64";

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

export const panel =
    "palette-raised flex min-h-0 min-w-0 flex-[1.4] flex-col gap-2 overflow-auto rounded-(--tr-radius) border border-palette-line bg-palette-base p-3 text-palette-contrast";

export const presets = "flex flex-wrap gap-1.5";

export const preset = "h-7 px-2 text-xs";

export const inputLabel =
    "font-medium text-palette-accent/85 text-xs uppercase tracking-wide";

export const input =
    "min-h-24 resize-y rounded-(--tr-radius) border border-palette-line bg-palette-soft p-2 font-mono text-palette-contrast text-xs leading-relaxed outline-none focus-visible:border-palette-ring focus-visible:ring-2 focus-visible:ring-palette-ring/30";

export const runRow = "flex items-center justify-end gap-2";

/** The primary action takes the blue palette. */
export const dispatch = "palette-blue";

export const runHint = "text-palette-accent/85 text-xs";

/** The outcome: the green palette for a value, the danger palette for an error. */
export const result = (status: "ok" | "error" | undefined) =>
    cn(
        "block max-h-40 shrink-0 overflow-auto whitespace-pre-wrap break-all rounded-(--tr-radius) border border-palette-line bg-palette-soft p-2 font-mono text-palette-accent text-xs",
        status === "ok" && "palette-green",
        status === "error" && "palette-danger",
    );

export const commands = "shrink-0 text-sm";

export const commandsSummary =
    "cursor-pointer select-none font-medium text-palette-accent text-xs";

export const commandList = "mt-2 flex flex-col gap-1.5";

export const command = "flex flex-col";

export const commandName = "font-mono text-palette-contrast text-xs";

export const commandDescription = "text-palette-accent/85 text-xs";
