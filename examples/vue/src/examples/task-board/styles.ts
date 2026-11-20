import { cn } from "#/lib/cn";

// How task-board looks: one class string per part, read by the SFCs. Colours come from
// the palette roles and sizes from the theme's --tr-* tokens, so it works in every theme.

export const frame =
    "flex min-h-0 flex-1 flex-col gap-3 p-4 font-(family-name:--tr-font) text-(length:--tr-size) text-palette-contrast";

export const toolbar = "flex flex-wrap items-center gap-2";

export const select =
    "h-8 min-w-0 rounded-(--tr-radius) border border-palette-line bg-palette-base px-2 text-palette-contrast text-sm outline-none focus-visible:border-palette-ring";

export const matches = "text-palette-accent/85 text-sm tabular-nums";

export const body =
    "grid min-h-0 flex-1 gap-3 lg:grid-cols-[minmax(0,20rem)_minmax(0,1fr)]";

export const root =
    "palette-raised min-h-0 overflow-auto rounded-(--tr-radius) border border-palette-line bg-palette-base p-1 shadow-(--tr-shadow) data-dragging:cursor-grabbing max-lg:max-h-72";

/** The item takes focus: its ring is drawn on its own row. A filter dims the rows it does not match. */
export const item =
    "outline-none data-dimmed:[&>[data-tree-part=content]]:opacity-40";

/** The indentation is the depth every part carries, `--tree-depth`, times the theme's indent. */
export const row = cn(
    "flex h-(--tr-row-height) cursor-default select-none items-center gap-(--tr-gap) rounded-(--tr-radius) pe-2",
    "ps-[calc(var(--tree-depth)*var(--tr-indent)+0.25rem)] hover:bg-(--tr-hover-bg)",
    // the theme's indentation guides: one line per level, under each ancestor's toggle
    "bg-(image:--tr-guide) bg-size-[calc(var(--tree-depth)*var(--tr-indent))_100%] bg-no-repeat",
    "bg-position-[calc(0.75rem-var(--tr-indent)/2)_0] rtl:bg-position-[right_calc(0.75rem-var(--tr-indent)/2)_top]",
    "[:focus-visible>&]:ring-(length:--tr-focus-width) [:focus-visible>&]:ring-palette-ring [:focus-visible>&]:ring-inset",
    "data-selected:bg-(--tr-selected-bg) data-selected:text-(--tr-selected-fg)",
    // the theme's marker: a bar at the inline start of a selected row (0px: none), out of the layout
    "relative before:absolute before:inset-y-0 before:start-0 before:w-(--tr-marker) before:rounded-full data-selected:before:bg-(--tr-marker-color)",
    "data-dragging:opacity-45",
);

export const toggle = cn(
    "flex size-4 shrink-0 items-center justify-center text-palette-accent/85 transition-[rotate] duration-(--tr-motion) data-leaf:invisible [&_svg]:size-3.5",
    // the theme's toggle: the chevron (or none), or a text drawn instead ("+" and "-")
    "[&_svg]:[display:var(--tr-toggle-icon)] before:content-(--tr-toggle-closed) data-expanded:before:content-(--tr-toggle-open)",
    "data-expanded:rotate-(--tr-toggle-turn) rtl:-scale-x-100 rtl:data-expanded:-rotate-(--tr-toggle-turn)",
);

/** The app's check: a box, checked or mixed (a parent with only some of its work done). */
export const checkbox = cn(
    "flex size-4 shrink-0 cursor-pointer items-center justify-center rounded-[4px] border border-palette-accent/60 transition-colors duration-(--tr-motion)",
    "data-checked:border-palette-contrast data-checked:bg-palette-contrast data-checked:text-palette-base",
    "data-indeterminate:border-palette-contrast data-indeterminate:bg-palette-contrast data-indeterminate:text-palette-base",
);

export const checkIcon = "hidden size-3 stroke-3 [[data-checked]>&]:block";

export const mixedIcon =
    "hidden size-3 stroke-3 [[data-indeterminate]>&]:block";

/** A project and an epic take the blue palette; a task its status's colour. */
export const kindIcon = {
    project: "palette-blue size-4 shrink-0 text-palette-accent",
    epic: "palette-purple size-4 shrink-0 text-palette-accent",
} as const;

export const statusIcon = {
    todo: "size-4 shrink-0 text-palette-accent/70",
    doing: "palette-blue size-4 shrink-0 text-palette-accent",
    review: "palette-orange size-4 shrink-0 text-palette-accent",
    done: "palette-green size-4 shrink-0 text-palette-accent",
} as const;

/** The label: struck through when done; hidden while the row's own input renames it. */
export const label =
    "min-w-0 flex-1 truncate [[data-renaming]>&]:hidden [[data-checked]>&]:text-palette-accent/70 [[data-checked]>&]:line-through";

export const input =
    "h-[calc(var(--tr-row-height)-6px)] min-w-0 flex-1 rounded-[4px] border border-palette-line bg-palette-base px-1.5 text-palette-contrast outline-none focus:border-palette-ring aria-invalid:border-palette-ring";

/** A priority's mark: the urgent ones stand out. */
export const priority = {
    low: "size-3.5 shrink-0 text-palette-accent/60",
    medium: "size-3.5 shrink-0 text-palette-accent/60",
    high: "palette-orange size-3.5 shrink-0 text-palette-accent",
    urgent: "palette-danger size-3.5 shrink-0 text-palette-accent",
} as const;

export const overdue = "palette-danger size-3.5 shrink-0 text-palette-accent";

/** The assignee: initials in a circle. */
export const avatar =
    "flex size-5 shrink-0 items-center justify-center rounded-full bg-palette-line font-semibold text-[0.6rem] text-palette-contrast";

/** A parent's progress: its done work over all of it. */
export const progress = "shrink-0 text-palette-accent/85 text-xs tabular-nums";

/** Where a drop line starts past its level (px), drag and drop's `indicatorInset`: past the root's and
 * the row's padding (4px each), the toggle and the check (16px each) and two gaps (6px). */
export const indicatorInset = 52;

export const dropIndicator = cn(
    "pointer-events-none z-10",
    "data-[drop-position=before]:-mt-px data-[drop-position=before]:border-t-(length:--tr-indicator-width) data-[drop-position=before]:[border-top-style:var(--tr-indicator-style)] data-[drop-position=before]:border-(--tr-indicator)",
    "data-[drop-position=after]:-mt-px data-[drop-position=after]:border-t-(length:--tr-indicator-width) data-[drop-position=after]:[border-top-style:var(--tr-indicator-style)] data-[drop-position=after]:border-(--tr-indicator)",
    "data-[drop-position=inside]:rounded-(--tr-radius) data-[drop-position=inside]:border-(length:--tr-indicator-width) data-[drop-position=inside]:[border-style:var(--tr-indicator-style)] data-[drop-position=inside]:border-(--tr-indicator)",
);

export const liveRegion = "sr-only";

/** The board: four columns beside the tree. */
export const board = "flex min-h-0 flex-col gap-2";

export const boardTitle = "m-0 font-semibold text-sm";

export const columns =
    "grid min-h-0 flex-1 grid-cols-2 gap-2 overflow-auto md:grid-cols-4";

/** A column; it lights up while a tree row is dragged over it (`data-over`). */
export const column = cn(
    "palette-raised flex min-h-32 flex-col gap-2 rounded-(--tr-radius) border border-palette-line bg-palette-base p-2 transition-colors",
    "data-over:border-palette-ring data-over:bg-(--tr-hover-bg)",
);

export const columnTitle =
    "m-0 flex items-center justify-between text-palette-accent text-xs uppercase tracking-wide";

export const cards = "m-0 flex list-none flex-col gap-2 p-0";

export const card =
    "flex flex-col gap-1.5 rounded-(--tr-radius) border border-palette-line bg-palette-base p-2 text-sm shadow-(--tr-shadow)";

export const cardMeta =
    "flex items-center gap-1.5 text-palette-accent/85 text-xs";

export const cardPerson = "min-w-0 truncate";

export const cardProgress = "shrink-0 whitespace-nowrap tabular-nums";

export const cardActions = "ms-auto flex shrink-0 gap-0.5";

export const cardButton =
    "flex size-6 items-center justify-center rounded-(--tr-radius) text-palette-accent/85 hover:bg-(--tr-hover-bg) hover:text-palette-contrast [&_svg]:size-3.5";

export const empty = "text-palette-accent/60 text-xs";
