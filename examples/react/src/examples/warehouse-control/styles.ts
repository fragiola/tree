import { cn } from "#/lib/cn";

// How warehouse-control looks: one class string (or state function) per part, read by the
// example's files. Colours come from the palette roles and sizes from the theme's --tr-* tokens,
// so it works in every theme; the charts are SVG drawn with the same roles.

export const frame =
    "flex min-h-0 flex-1 flex-col gap-3 p-3 font-(family-name:--tr-font) text-(length:--tr-size) text-palette-contrast max-md:overflow-auto";

export const toolbar = "flex flex-wrap items-center gap-2";

/** Where the panels look: the selected location's path, or the whole network. */
export const scope = "m-0 me-auto flex min-w-0 items-baseline gap-2";

export const scopeTerm = "shrink-0 text-palette-accent/85 text-xs";

export const scopeValue = "truncate font-semibold";

/** The feed's state and its clock: a dot that is lit while it plays. */
export const status = (playing: boolean) =>
    cn(
        "flex items-center gap-1.5 text-palette-accent/85 text-xs tabular-nums",
        "before:size-2 before:rounded-full before:bg-palette-accent",
        playing
            ? "palette-green before:animate-pulse motion-reduce:before:animate-none"
            : "before:opacity-40",
    );

/** The tree is a narrow column, never the width of the scene; the panels take the rest. */
export const body =
    "grid min-h-0 flex-1 gap-3 md:grid-cols-[19rem_minmax(0,1fr)]";

/** The scroll container of the tree, and the drop indicator's containing block. */
export const root =
    "palette-raised relative min-h-0 overflow-auto rounded-(--tr-radius) border border-palette-line bg-palette-base p-1 shadow-(--tr-shadow) data-dragging:cursor-grabbing max-md:max-h-72";

/** The item takes focus: its ring is drawn on its own row (`[:focus-visible>&]`). */
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

/** The locations are quiet; a site stands out. */
export const icon = {
    site: "palette-blue size-4 shrink-0 text-palette-accent",
    location: "size-4 shrink-0 text-palette-accent/85",
} as const;

/** A climate's colour, on a zone and on the bins that need it (a palette is a class). */
export const climate = {
    ambient: "palette-orange size-4 shrink-0 text-palette-accent",
    cold: "palette-blue size-4 shrink-0 text-palette-accent",
    frozen: "palette-purple size-4 shrink-0 text-palette-accent",
    hazmat: "palette-danger size-4 shrink-0 text-palette-accent",
    returns: "palette-green size-4 shrink-0 text-palette-accent",
} as const;

export const label = "min-w-0 flex-1 truncate";

/** The units under a location: secondary, aligned figures. */
export const units = "shrink-0 text-palette-accent/85 text-xs tabular-nums";

/** A bin's fill: a track, and a bar whose colour says how much is left. */
export const fill =
    "h-1.5 w-10 shrink-0 overflow-hidden rounded-full bg-palette-line";

/** A fill's palette: little left is a warning, almost nothing a danger. */
const fillPalette = (ratio: number) =>
    ratio < 0.15
        ? "palette-danger"
        : ratio < 0.35
          ? "palette-orange"
          : "palette-green";

export const fillBar = (ratio: number) =>
    cn(
        "block h-full rounded-full bg-palette-accent transition-[width] duration-(--tr-motion)",
        fillPalette(ratio),
    );

/** Low stock: a warning, with the count on a location. */
export const low =
    "palette-orange flex shrink-0 items-center gap-0.5 text-palette-accent text-xs tabular-nums [&_svg]:size-3.5";

/** Where a drop line starts past its level (px), drag and drop's `indicatorInset`: past the root's and
 * the row's padding (4px each), the toggle (16px) and the gap (6px), at the icon. */
export const indicatorInset = 30;

/** A line before or after a row (from the icon), the row's box inside an aisle. */
export const dropIndicator = cn(
    "pointer-events-none z-10",
    "data-[drop-position=before]:-mt-px data-[drop-position=before]:border-t-(length:--tr-indicator-width) data-[drop-position=before]:[border-top-style:var(--tr-indicator-style)] data-[drop-position=before]:border-(--tr-indicator)",
    "data-[drop-position=after]:-mt-px data-[drop-position=after]:border-t-(length:--tr-indicator-width) data-[drop-position=after]:[border-top-style:var(--tr-indicator-style)] data-[drop-position=after]:border-(--tr-indicator)",
    "data-[drop-position=inside]:rounded-(--tr-radius) data-[drop-position=inside]:border-(length:--tr-indicator-width) data-[drop-position=inside]:[border-style:var(--tr-indicator-style)] data-[drop-position=inside]:border-(--tr-indicator)",
);

export const liveRegion = "sr-only";

/** Words for assistive technology only. */
export const srOnly = "sr-only";

/** The scene beside the tree: the figures, the chart and the feed, then the bins. */
export const scene = "flex min-h-0 min-w-0 flex-col gap-3 md:overflow-auto";

export const kpis = "m-0 grid grid-cols-2 gap-2 lg:grid-cols-4";

/** A card: the raised palette, as the tree's frame. */
const card =
    "palette-raised rounded-(--tr-radius) border border-palette-line bg-palette-base shadow-(--tr-shadow)";

export const kpi = cn(card, "flex min-w-0 flex-col gap-0.5 px-3 py-2");

export const kpiTerm = "truncate text-palette-accent/85 text-xs";

export const kpiValue = "m-0 font-semibold text-lg tabular-nums leading-tight";

/** A figure's note; a warning when it counts low stock. */
export const kpiNote = (warning: boolean) =>
    cn(
        "truncate text-xs tabular-nums",
        warning
            ? "palette-orange text-palette-accent"
            : "text-palette-accent/85",
    );

/** The units' sparkline: a line over the last ticks. */
export const spark = "palette-blue mt-0.5 h-5 w-full overflow-visible";

export const sparkLine = "fill-none stroke-[1.5] stroke-palette-accent";

export const panels = "grid gap-3 lg:grid-cols-2";

export const panel = cn(card, "flex min-w-0 flex-col gap-2 p-3");

export const panelTitle = "m-0 font-semibold text-sm";

export const chart = "h-auto w-full";

export const chartLabel = (current: boolean) =>
    cn("fill-palette-contrast text-[11px]", current && "font-semibold");

export const chartTrack = "fill-palette-line";

export const chartBar = (ratio: number) =>
    cn(
        "fill-palette-accent transition-[width] duration-(--tr-motion)",
        fillPalette(ratio),
    );

export const chartValue = "fill-palette-accent/85 text-[11px] tabular-nums";

/** The marker of a location with low stock, after its figure. */
export const chartLow = "palette-orange fill-palette-accent";

/** The movements: newest first, one line each. */
export const feed = "m-0 flex list-none flex-col gap-1 p-0";

export const movement = "flex min-w-0 items-center gap-2 text-xs";

export const movementTime = "shrink-0 text-palette-accent/85 tabular-nums";

/** A pick takes units out (orange), a receipt brings them in (green). */
export const movementIcon = (kind: "pick" | "receipt") =>
    cn(
        "size-3.5 shrink-0 text-palette-accent",
        kind === "pick" ? "palette-orange" : "palette-green",
    );

export const movementBin = "min-w-0 flex-1 truncate";

export const movementDelta = (kind: "pick" | "receipt") =>
    cn(
        "shrink-0 font-semibold tabular-nums text-palette-accent",
        kind === "pick" ? "palette-orange" : "palette-green",
    );

export const empty = "m-0 text-palette-accent/85 text-xs";

/** The bins of the scope, lowest stock first. */
export const table = "w-full border-collapse text-xs tabular-nums";

export const caption = "pb-1 text-start text-palette-accent/85";

export const headCell =
    "border-palette-line border-b px-2 py-1 text-start font-medium text-palette-accent/85";

export const numberHeadCell =
    "border-palette-line border-b px-2 py-1 text-end font-medium text-palette-accent/85";

export const cell = "border-palette-line border-b px-2 py-1 text-start";

export const numberCell = "border-palette-line border-b px-2 py-1 text-end";

/** A bin's state: low on stock, or fine. */
export const badge = (lowStock: boolean) =>
    cn(
        "inline-flex rounded-(--tr-radius) border px-1.5 text-[11px] text-palette-accent",
        lowStock
            ? "palette-orange border-palette-line"
            : "palette-green border-palette-line",
    );
