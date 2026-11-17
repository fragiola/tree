import { cn } from "#/lib/cn";

// How checkboxes looks: one class string per part, read by the component. Colours come from the
// palette roles and sizes from the theme's --tr-* tokens, so it works in every theme.

export const frame =
    "flex min-h-0 flex-1 flex-col gap-3 p-4 font-(family-name:--tr-font) text-(length:--tr-size) sm:flex-row";

export const root =
    "palette-raised min-h-0 flex-1 overflow-auto rounded-(--tr-radius) border border-palette-line bg-palette-base p-1 text-palette-contrast shadow-(--tr-shadow)";

export const item = "outline-none";

export const row = cn(
    "flex h-(--tr-row-height) cursor-default select-none items-center gap-(--tr-gap) rounded-(--tr-radius) pe-2",
    "ps-[calc(var(--tree-depth)*var(--tr-indent)+0.25rem)] hover:bg-(--tr-hover-bg)",
    "[:focus-visible>&]:ring-2 [:focus-visible>&]:ring-palette-ring [:focus-visible>&]:ring-inset",
);

export const toggle = cn(
    "flex size-4 shrink-0 items-center justify-center text-palette-accent/85 transition-[rotate] duration-(--tr-motion) data-leaf:invisible [&_svg]:size-3.5",
    "data-expanded:rotate-90 rtl:-scale-x-100 rtl:data-expanded:-rotate-90",
);

/** An empty box; checked or mixed, it fills with the contrast colour and shows its mark. */
export const checkbox = cn(
    "flex size-4 shrink-0 cursor-pointer items-center justify-center rounded-[4px] border border-palette-accent/60 transition-colors duration-(--tr-motion)",
    "data-checked:border-palette-contrast data-checked:bg-palette-contrast data-checked:text-palette-base",
    "data-indeterminate:border-palette-contrast data-indeterminate:bg-palette-contrast data-indeterminate:text-palette-base",
    "data-disabled:cursor-not-allowed data-disabled:opacity-50",
);

/** Each mark shows on its own state of the checkbox, its direct parent. */
export const checkIcon = "hidden size-3 stroke-3 [[data-checked]>&]:block";

export const mixedIcon =
    "hidden size-3 stroke-3 [[data-indeterminate]>&]:block";

export const label = "truncate";

export const readout =
    "palette-raised flex shrink-0 flex-col gap-2 rounded-(--tr-radius) border border-palette-line bg-palette-base p-3 text-palette-contrast sm:w-52 sm:self-start";

export const readoutTitle =
    "font-medium text-palette-accent/85 text-xs uppercase tracking-wide";

export const scopes = "flex flex-wrap gap-1.5";

export const scope =
    "rounded-(--tr-radius) bg-palette-soft px-1.5 py-0.5 font-mono text-palette-accent text-xs";

export const empty = "text-palette-accent/85 text-sm";
