// The rename's slice of the state, and how its code reads and writes it.
import type { Draft } from "../state/draft";
import type { TreeItem, TreeSettings, TreeState } from "../state/types";

/** What `rename()` adds to the state. */
export interface RenameState {
    /** the item whose label is being edited */
    readonly renamingItemId: string | null;
    readonly settings: RenameSettings;
}

/** What `rename()` adds to the settings. */
export interface RenameSettings {
    /** the default of the items' `renamable` flag */
    readonly renamable: boolean;
}

interface RenameSlice {
    readonly renamingItemId?: string | null;
    readonly settings: { readonly renamable?: boolean };
}

const slice = (state: TreeState) => state as unknown as RenameSlice;

/** The item being renamed. */
export function renamingOf(state: TreeState): string | null {
    return slice(state).renamingItemId ?? null;
}

/** Whether an item's label can be edited: its flag, else the tree's default (true). */
export function isRenamable(
    settings: TreeSettings | TreeState["settings"],
    item: TreeItem,
): boolean {
    return (
        item.renamable ??
        (settings as { readonly renamable?: boolean }).renamable ??
        true
    );
}

export function setRenaming(draft: Draft, itemId: string | null): void {
    draft.setField("renamingItemId", itemId);
}

/** Stops the rename of an item that can no longer be renamed (disabled, not renamable). */
export function stopIfNotRenamable(draft: Draft, itemId: string): void {
    if (renamingOf(draft.state) !== itemId) return;
    const item = draft.item(itemId);
    if (!item || item.disabled === true || !isRenamable(draft.settings, item))
        setRenaming(draft, null);
}
