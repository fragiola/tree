/**
 * What an app declares about its tree's data: each item kind's data type, keyed by the kind.
 * `item.data` narrows on `item.kind`.
 *
 * ```ts
 * type Types = { items: { folder: undefined; file: { size: number } } };
 * const model = createTreeModel<Types>(json);
 * ```
 */
export interface TreeTypes {
    /** each item kind's data type, keyed by the kind */
    items: object;
}

/** The registry used when an app declares none: any kind, `unknown` data. */
export interface AnyTypes {
    items: Record<string, unknown>;
}

/** The item kinds of a registry. */
export type KindOf<T extends TreeTypes> = Extract<keyof T["items"], string>;

/** The data type of kind `K` of a registry. */
export type DataOf<
    T extends TreeTypes,
    K extends string,
> = K extends keyof T["items"] ? T["items"][K] : never;

/**
 * Where a parent's children come from the app's loader: `unloaded` (never asked), `loading`,
 * `loaded` or `error` (the last load failed). A parent without it holds its children itself.
 */
export type ChildrenStatus = "unloaded" | "loading" | "loaded" | "error";

/** A checkbox's state: `mixed` is a parent with only some of its descendants checked. */
export type CheckState = "checked" | "unchecked" | "mixed";

/** How many items can be selected. */
export type SelectionMode = "none" | "single" | "multiple";

/**
 * How checkboxes relate: `cascade` checks a parent's descendants with it and derives a parent's
 * state from its children; `independent` checks each item on its own.
 */
export type CheckMode = "cascade" | "independent";

/** The permission flags of an item; an item without one takes the tree's default. */
export interface ItemFlags {
    /** focusable, but not actionable: no expand, select, check, rename, move or drop */
    disabled?: boolean;
    /** whether the item can be moved (`item.move`, a drag) */
    movable?: boolean;
    /** whether the item's label can be edited (`item.start-rename`, `item.rename`) */
    renamable?: boolean;
    /** whether the item accepts items moved into it (a parent only) */
    droppable?: boolean;
}

/**
 * The tree's settings: its modes, and the defaults of the item flags. An installed feature adds its
 * own (`selection()`: `selectionMode`; `checkboxes()`: `checkMode`;
 * `rename()`: `renamable`).
 */
export interface TreeSettings {
    readonly movable: boolean;
    readonly droppable: boolean;
}

/** The settings of a tree whose document gives none. */
export const DEFAULT_SETTINGS: TreeSettings = Object.freeze({
    movable: true,
    droppable: true,
});

/** An item: kind `K` with data `D`. */
export interface TreeItem<K extends string = string, D = unknown>
    extends Readonly<ItemFlags> {
    readonly id: string;
    /** what the item is: the registry key that types `data` */
    readonly kind: K;
    /** the item's name, as the app wrote it: never translated, never rendered by the packages */
    readonly label: string;
    /** the app's data for the item */
    readonly data: D;
    /** its children, in order (a parent); absent on a leaf or a parent not loaded yet */
    readonly childItemIds?: readonly string[];
    /** where its children come from the app's loader; absent when the item holds them itself */
    readonly childrenStatus?: ChildrenStatus;
}

/** An item of the registry `T`: a union discriminated by `kind`, so `data` narrows. */
export type ItemOf<T extends TreeTypes> = {
    [K in KindOf<T>]: TreeItem<K, DataOf<T, K>>;
}[KindOf<T>];

/**
 * The state of a tree: plain, frozen, JSON-shaped data. An installed feature adds its own fields
 * (`selection()`: `selectedItemIds`, `selectionAnchorItemId`). A command produces a new state that
 * shares every item it did not touch; `before === after` means nothing changed.
 */
export interface TreeState<T extends TreeTypes = AnyTypes> {
    readonly settings: TreeSettings;
    /** the root items, in order */
    readonly rootItemIds: readonly string[];
    /** every item, by id */
    readonly items: { readonly [id: string]: ItemOf<T> };
    readonly expandedItemIds: readonly string[];
    /** the roving tab stop: the item that takes focus when the tree does (always visible) */
    readonly focusedItemId: string | null;
}

/** An item as it is rendered: its place in the flat render order. */
export interface VisibleItem {
    readonly itemId: string;
    /** its parent, `null` for a root item */
    readonly parentItemId: string | null;
    /** 1 for a root item (`aria-level`) */
    readonly level: number;
    /** its 1-based position among its siblings (`aria-posinset`) */
    readonly posinset: number;
    /** how many siblings it has, itself included (`aria-setsize`) */
    readonly setsize: number;
}
