import { cn } from "#/lib/cn";

// How permissions-admin looks: one class string per part, read by the SFCs. Colours
// come from the palette roles and sizes from the theme's --tr-* tokens, so it works in every theme.

export const frame =
    "flex min-h-0 flex-1 flex-col gap-3 p-4 font-(family-name:--tr-font) text-(length:--tr-size) text-palette-contrast";

export const toolbar = "flex flex-wrap items-center gap-3";

export const field = "flex items-center gap-2";

export const fieldLabel = "text-palette-accent/85 text-sm";

export const select =
    "h-8 min-w-0 rounded-(--tr-radius) border border-palette-line bg-palette-base px-2 text-palette-contrast text-sm outline-none focus-visible:border-palette-ring";

export const searchField = "relative flex items-center";

export const searchIcon =
    "pointer-events-none absolute start-2 size-4 text-palette-accent/70";

export const search =
    "h-8 w-56 min-w-0 rounded-(--tr-radius) border border-palette-line bg-palette-base ps-8 pe-2 text-palette-contrast text-sm outline-none focus-visible:border-palette-ring";

export const matches = "text-palette-accent/85 text-sm tabular-nums";

export const body = "flex min-h-0 flex-1 flex-col gap-3 md:flex-row";

export const root =
    "palette-raised min-h-0 flex-1 overflow-auto rounded-(--tr-radius) border border-palette-line bg-palette-base p-1 shadow-(--tr-shadow)";

/** The item takes focus; a search dims the rows it does not match, and marks the ones it does. */
export const item = cn(
    "outline-none data-dimmed:[&>[data-tree-part=content]]:opacity-40",
    "data-match:[&>[data-tree-part=content]]:font-semibold",
);

/** The indentation is the depth every part carries, `--tree-depth`, times the theme's indent. */
export const row = cn(
    "flex h-(--tr-row-height) cursor-default select-none items-center gap-(--tr-gap) rounded-(--tr-radius) pe-2",
    "ps-[calc(var(--tree-depth)*var(--tr-indent)+0.25rem)] hover:bg-(--tr-hover-bg)",
    // the theme's indentation guides: one line per level, under each ancestor's toggle
    "bg-(image:--tr-guide) bg-size-[calc(var(--tree-depth)*var(--tr-indent))_100%] bg-no-repeat",
    "bg-position-[calc(0.75rem-var(--tr-indent)/2)_0] rtl:bg-position-[right_calc(0.75rem-var(--tr-indent)/2)_top]",
    "[:focus-visible>&]:ring-(length:--tr-focus-width) [:focus-visible>&]:ring-palette-ring [:focus-visible>&]:ring-inset",
);

export const toggle = cn(
    "flex size-4 shrink-0 items-center justify-center text-palette-accent/85 transition-[rotate] duration-(--tr-motion) data-leaf:invisible [&_svg]:size-3.5",
    // the theme's toggle: the chevron (or none), or a text drawn instead ("+" and "-")
    "[&_svg]:[display:var(--tr-toggle-icon)] before:content-(--tr-toggle-closed) data-expanded:before:content-(--tr-toggle-open)",
    "data-expanded:rotate-(--tr-toggle-turn) rtl:-scale-x-100 rtl:data-expanded:-rotate-(--tr-toggle-turn)",
);

/** The app's check: a box, checked or mixed; a granted action's is dimmed (focusable, not actionable). */
export const checkbox = cn(
    "flex size-4 shrink-0 cursor-pointer items-center justify-center rounded-[4px] border border-palette-accent/60 transition-colors duration-(--tr-motion)",
    "data-checked:border-palette-contrast data-checked:bg-palette-contrast data-checked:text-palette-base",
    "data-indeterminate:border-palette-contrast data-indeterminate:bg-palette-contrast data-indeterminate:text-palette-base",
    "data-disabled:cursor-not-allowed data-disabled:opacity-50",
);

export const checkIcon = "hidden size-3 stroke-3 [[data-checked]>&]:block";

export const mixedIcon =
    "hidden size-3 stroke-3 [[data-indeterminate]>&]:block";

export const kindIcon = {
    organization: "palette-blue size-4 shrink-0 text-palette-accent",
    area: "palette-purple size-4 shrink-0 text-palette-accent",
    resource: "size-4 shrink-0 text-palette-accent/85",
} as const;

export const verbIcon = "size-3.5 shrink-0 text-palette-accent/70";

export const label =
    "min-w-0 flex-1 truncate [[data-disabled]>&]:text-palette-accent/85";

export const lock = "size-3.5 shrink-0 text-palette-accent/70";

export const risk = "palette-orange size-3.5 shrink-0 text-palette-accent";

/** The change since the last save: + added, − removed. */
export const change = {
    added: "palette-green w-3 shrink-0 text-center font-semibold text-palette-accent",
    removed:
        "palette-danger w-3 shrink-0 text-center font-semibold text-palette-accent",
} as const;

/** The changes panel, beside the tree. */
export const summary =
    "palette-raised flex shrink-0 flex-col gap-3 rounded-(--tr-radius) border border-palette-line bg-palette-base p-4 shadow-(--tr-shadow) md:w-64";

export const summaryTitle = "m-0 font-semibold text-base";

export const summaryText = "m-0 text-palette-accent/85 text-sm";

export const areas = "m-0 flex list-none flex-col gap-1 p-0 text-sm";

export const area = "flex justify-between gap-2";

export const counts = "flex gap-2 tabular-nums";

export const added = "palette-green text-palette-accent";

export const removed = "palette-danger text-palette-accent";

export const actions = "flex flex-wrap justify-end gap-2";

export const danger = "palette-danger";

export const notice = "m-0 min-h-5 text-palette-accent/85 text-sm";

/** The confirmation: a native dialog, centred, over a dimmed page. */
export const dialog =
    "palette-raised m-auto w-[min(26rem,calc(100%-2rem))] rounded-(--tr-radius) border border-palette-line bg-palette-base p-5 text-palette-contrast shadow-(--tr-shadow) backdrop:bg-black/40";

export const dialogTitle = "m-0 mb-3 font-semibold text-base";

export const riskyList = "m-0 mb-4 flex list-disc flex-col gap-1 ps-5 text-sm";
