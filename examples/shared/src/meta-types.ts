// The shape of an example's meta.ts. Site-internal: examples never import this
// from their code, only their meta.ts does. The fields map onto an entry of the
// site export's manifest.json (scripts/manifest.ts).
//
// The gallery groups examples by category: the feature they show. The site export contract (v1.2)
// calls a category a `level`: `examples.json` lists CATEGORIES as its `levels`, and each manifest
// entry's `level` is its category's id (scripts/manifest.ts, site/sources.ts).

/** The gallery's groups, in the order the sidebar lists them. */
export const CATEGORIES = [
    "getting-started",
    "selection",
    "editing",
    "data",
    "model-api",
    "accessibility",
] as const;

export type Category = (typeof CATEGORIES)[number];

export const CATEGORY_TITLES: Record<Category, string> = {
    "getting-started": "Getting started",
    selection: "Selection and checkboxes",
    editing: "Editing and drag and drop",
    data: "Data and state",
    "model-api": "Model API",
    accessibility: "Keyboard and accessibility",
};

export interface ExampleMeta {
    /** the example's name in the sidebar and the page title */
    title: string;
    /** one or two sentences: what it shows */
    description: string;
    /** the feature it shows: its group in the gallery */
    category: Category;
    /** position inside its category, ascending */
    order: number;
    /** the APIs and techniques it shows, as short tags */
    features: string[];
    /** the docs page it belongs to, e.g. "/docs/guides/selection" */
    docs?: string;
    /**
     * How the site sizes its frame. `"fill"` (the default): the example fills a frame of
     * `height` (a tree scrolls inside it). `"flow"`: the frame grows with the content, `height` is
     * its floor.
     */
    layout?: ExampleLayout;
    /** the frame height in pixels (default: {@link DEFAULT_HEIGHT} for its category) */
    height?: number;
}

export const LAYOUTS = ["fill", "flow"] as const;

export type ExampleLayout = (typeof LAYOUTS)[number];

/** The frame height of an example that names none. */
export const DEFAULT_HEIGHT: Record<Category, number> = {
    "getting-started": 420,
    selection: 460,
    editing: 460,
    data: 480,
    "model-api": 520,
    accessibility: 460,
};
