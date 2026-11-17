import { cn } from "#/lib/cn";

// How ide-explorer looks: one class string per part, read by the example's files. Colours come
// from the palette roles and sizes from the theme's --tr-* tokens, so it works in every theme.

/** The workbench: the explorer beside the editor, a status bar under both. */
export const frame =
    "flex min-h-0 flex-1 flex-col font-(family-name:--tr-font) text-(length:--tr-size) text-palette-contrast";

export const body =
    "flex min-h-0 flex-1 flex-col divide-palette-line border-palette-line border-b max-sm:divide-y sm:flex-row sm:divide-x";

/** The explorer's side bar: its title and toolbar, then the tree. */
export const sideBar =
    "palette-raised flex min-h-0 flex-col bg-palette-base max-sm:h-1/2 sm:w-72 sm:shrink-0";

export const sideBarHeader =
    "flex h-9 shrink-0 items-center gap-1 ps-3 pe-1 text-palette-accent/85 text-xs uppercase tracking-wide";

export const sideBarTitle = "me-auto font-semibold";

/** A toolbar button: an icon alone, its name for assistive technology. */
export const toolButton =
    "size-7 rounded-(--tr-radius) text-palette-accent/85 hover:text-palette-contrast [&_svg]:size-4";

export const root = "min-h-0 flex-1 overflow-auto px-1 pb-2 outline-none";

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

/** Each kind of file takes its palette's accent: code blue, data orange, styles purple, … */
export const fileIcon = {
    code: "palette-blue size-4 shrink-0 text-palette-accent",
    data: "palette-orange size-4 shrink-0 text-palette-accent",
    style: "palette-purple size-4 shrink-0 text-palette-accent",
    image: "palette-green size-4 shrink-0 text-palette-accent",
    config: "size-4 shrink-0 text-palette-accent/85",
    secret: "palette-danger size-4 shrink-0 text-palette-accent",
    lock: "size-4 shrink-0 text-palette-accent/60",
    text: "size-4 shrink-0 text-palette-accent/85",
} as const;

/** Folders are blue, the special ones purple, the package manager's quiet. */
export const folderIcon = {
    plain: "palette-blue size-4 shrink-0 text-palette-accent",
    source: "palette-purple size-4 shrink-0 text-palette-accent",
    tests: "palette-purple size-4 shrink-0 text-palette-accent",
    git: "palette-purple size-4 shrink-0 text-palette-accent",
    managed: "size-4 shrink-0 text-palette-accent/60",
} as const;

/** A git status's colour, on the label and its letter (a palette is a class, not a variant). */
const STATUS_COLORS = {
    modified: "palette-orange text-palette-accent",
    added: "palette-green text-palette-accent",
    untracked: "palette-green text-palette-accent",
} as const;

type Status = keyof typeof STATUS_COLORS;

/**
 * The label, in its git status's colour; node_modules' quieter, as an editor shows ignored files.
 * It hides while the row's own input renames it.
 */
export const label = (state: {
    status?: Status | undefined;
    managed: boolean;
}) =>
    cn(
        "min-w-0 flex-1 truncate [[data-renaming]>&]:hidden",
        state.status && STATUS_COLORS[state.status],
        state.managed && "text-palette-contrast/60",
    );

/** The status letter at the row's end. */
export const status = (state: Status) =>
    cn("w-3 shrink-0 text-center font-semibold text-xs", STATUS_COLORS[state]);

/** A folder holding a change: a dot where a file shows its letter. */
export const changedDot =
    "palette-orange me-1 size-1.5 shrink-0 rounded-full bg-palette-accent";

export const spinner =
    "size-3.5 shrink-0 animate-spin text-palette-accent/85 motion-reduce:animate-none";

export const input =
    "h-[calc(var(--tr-row-height)-6px)] min-w-0 flex-1 rounded-[4px] border border-palette-line bg-palette-base px-1.5 text-palette-contrast outline-none focus:border-palette-ring aria-invalid:border-palette-ring";

/** Where a drop line starts past its level (px), drag and drop's `indicatorInset`: past the root's and
 * the row's padding (4px each), the toggle (16px) and the gap (6px), at the icon. */
export const indicatorInset = 30;

/** A line before or after a row (from the icon), the row's box inside a folder. */
export const dropIndicator = cn(
    "pointer-events-none z-10",
    "data-[drop-position=before]:-mt-px data-[drop-position=before]:border-t-(length:--tr-indicator-width) data-[drop-position=before]:[border-top-style:var(--tr-indicator-style)] data-[drop-position=before]:border-(--tr-indicator)",
    "data-[drop-position=after]:-mt-px data-[drop-position=after]:border-t-(length:--tr-indicator-width) data-[drop-position=after]:[border-top-style:var(--tr-indicator-style)] data-[drop-position=after]:border-(--tr-indicator)",
    "data-[drop-position=inside]:rounded-(--tr-radius) data-[drop-position=inside]:border-(length:--tr-indicator-width) data-[drop-position=inside]:[border-style:var(--tr-indicator-style)] data-[drop-position=inside]:border-(--tr-indicator)",
);

/** Read by screen readers only: the live region and the notices. */
export const liveRegion = "sr-only";

/** The editor area: tabs, the breadcrumb, then the code. */
export const editor = "flex min-h-0 min-w-0 flex-1 flex-col bg-palette-base";

export const tabList =
    "palette-raised flex h-9 shrink-0 items-stretch overflow-x-auto border-palette-line border-b bg-palette-base";

export const tab = cn(
    "group flex shrink-0 items-center gap-1.5 border-palette-line border-e ps-3 pe-1 text-palette-accent/85",
    "data-active:bg-palette-base data-active:text-palette-contrast data-active:shadow-[inset_0_2px_0] data-active:shadow-palette-ring",
);

export const tabButton =
    "flex h-full items-center gap-1.5 outline-none focus-visible:underline [&_svg]:size-3.5";

export const tabClose =
    "flex size-5 items-center justify-center rounded-(--tr-radius) opacity-60 hover:bg-(--tr-hover-bg) hover:opacity-100 focus-visible:opacity-100 group-data-active:opacity-100 [&_svg]:size-3.5";

export const breadcrumb =
    "flex h-7 shrink-0 items-center gap-1 overflow-hidden px-3 text-palette-accent/85 text-xs [&_svg]:size-3 [&_svg]:shrink-0";

export const crumb =
    "flex min-w-0 items-center gap-1 truncate last:text-palette-contrast";

/** The code: line numbers in a gutter, the text in the theme's font, scrolled in place. */
export const code =
    "m-0 min-h-0 flex-1 overflow-auto py-2 font-mono text-xs leading-5 outline-none focus-visible:ring-(length:--tr-focus-width) focus-visible:ring-palette-ring focus-visible:ring-inset";

export const line = "flex whitespace-pre pe-4";

export const lineNumber =
    "w-12 shrink-0 select-none pe-4 text-end text-palette-accent/60 tabular-nums";

export const empty =
    "flex flex-1 items-center justify-center p-6 text-center text-palette-accent/85";

/** The status bar: the branch, the changes, the selection and the last notice. */
export const statusBar =
    "palette-raised flex h-7 shrink-0 items-center gap-4 bg-palette-base px-3 text-palette-accent text-xs [&_svg]:size-3.5";

export const statusItem = "flex items-center gap-1 whitespace-nowrap";

export const notice = "ms-auto truncate";
