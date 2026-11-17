// What the primitives read of the selection feature's state, when it is installed: a tree without
// `selection()` has no selection (no list, no mode).
import type { SelectionMode, TreeState } from "@fragiola/tree";

interface SelectionLike {
    readonly selectedItemIds?: readonly string[];
    readonly settings: { readonly selectionMode?: SelectionMode };
}

const NONE: readonly string[] = Object.freeze([]);

/** The selected items (none without the selection feature). */
export function selectedIdsOf(state: TreeState): readonly string[] {
    return (state as unknown as SelectionLike).selectedItemIds ?? NONE;
}

/** The selection mode, `undefined` without the selection feature. */
export function selectionModeOf(state: TreeState): SelectionMode | undefined {
    return (state as unknown as SelectionLike).settings.selectionMode;
}
