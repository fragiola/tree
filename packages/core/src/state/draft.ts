// The working copy one command (or one batch) changes. It copies the items map once, on the first
// write, and replaces only what changes, so the committed state shares every untouched item with
// the one before (`before.items.x === after.items.x`).
import type { IdSource } from "./ids";
import { itemOf } from "./structure";
import type { TreeItem, TreeSettings, TreeState } from "./types";

type Mutable<T> = { -readonly [K in keyof T]: T[K] };

/** The fields of a state that hold one value or one list (everything but the items). */
export type StateField = Exclude<keyof TreeState, "items">;

export class Draft {
    private readonly base: TreeState;
    private readonly fields: Partial<Mutable<TreeState>> = {};
    private items: Record<string, TreeItem> | undefined;
    private snapshot: TreeState | undefined;
    readonly ids: IdSource;

    constructor(base: TreeState, ids: IdSource) {
        this.base = base;
        this.ids = ids;
    }

    /**
     * The state as the command sees it now: a new object after every change (the structure reads
     * cache on it), the same one while nothing changes.
     */
    get state(): TreeState {
        this.snapshot ??= {
            ...this.base,
            ...this.fields,
            items: this.items ?? this.base.items,
        };
        return this.snapshot;
    }

    get settings(): TreeSettings {
        return this.state.settings;
    }

    item(id: string): TreeItem | undefined {
        return itemOf(this.state, id);
    }

    /** Whether an id is taken by an item of the draft. */
    isUsed(id: string): boolean {
        return this.item(id) !== undefined;
    }

    /** A fresh item id. */
    nextId(): string {
        return this.ids.next((id) => this.isUsed(id));
    }

    /** Sets (adds or replaces) an item. */
    setItem(item: TreeItem): void {
        this.items ??= { ...this.base.items };
        this.items[item.id] = item;
        this.snapshot = undefined;
    }

    /** Replaces some fields of an item (`undefined` removes one). */
    patchItem(id: string, patch: Partial<Mutable<TreeItem>>): void {
        const item = this.item(id);
        if (!item) return;
        const next: Record<string, unknown> = { ...item };
        for (const [key, value] of Object.entries(patch)) {
            if (value === undefined) delete next[key];
            else next[key] = value;
        }
        this.setItem(next as unknown as TreeItem);
    }

    deleteItem(id: string): void {
        if (!this.isUsed(id)) return;
        this.items ??= { ...this.base.items };
        delete this.items[id];
        this.snapshot = undefined;
    }

    /** Replaces one field of the state. */
    set<K extends StateField>(field: K, value: TreeState[K]): void {
        if (this.state[field] === value) return;
        (this.fields as Record<string, unknown>)[field] = value;
        this.snapshot = undefined;
    }

    /** The children of a parent (`null`: the root items) set to `ids`. */
    setChildIds(parentItemId: string | null, ids: readonly string[]): void {
        if (parentItemId === null) this.set("rootItemIds", ids);
        else this.patchItem(parentItemId, { childItemIds: ids });
    }

    /** Whether anything changed. */
    get changed(): boolean {
        return this.items !== undefined || Object.keys(this.fields).length > 0;
    }

    /**
     * The committed state: the base itself when nothing changed, else a new frozen state (`freeze`)
     * sharing every untouched item.
     */
    commit(freeze: boolean): TreeState {
        if (!this.changed) return this.base;
        const state = this.state;
        if (freeze) deepFreeze(state);
        return state;
    }
}

/** Freezes a JSON-shaped value and everything in it (stops at what is frozen already). */
export function deepFreeze<V>(value: V): V {
    if (
        value !== null &&
        typeof value === "object" &&
        !Object.isFrozen(value)
    ) {
        Object.freeze(value);
        for (const child of Object.values(value)) deepFreeze(child);
    }
    return value;
}
