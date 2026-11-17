// The selection's slice of the state, and how its code reads and writes it on a draft.
import type { Draft } from "../state/draft";
import type { SelectionMode } from "../state/types";

/** What `selection()` adds to the state. */
export interface SelectionState {
    /** the selection, in the order it was made */
    readonly selectedItemIds: readonly string[];
    /** where a range selection (`item.select` with `extend`) starts */
    readonly selectionAnchorItemId: string | null;
    readonly settings: SelectionSettings;
}

/** What `selection()` adds to the settings. */
export interface SelectionSettings {
    /** how many items can be selected */
    readonly selectionMode: SelectionMode;
}

/** The selection as a state holds it (a model without `selection()` has none). */
export interface SelectionSlice {
    readonly selectedItemIds?: readonly string[];
    readonly selectionAnchorItemId?: string | null;
    readonly settings: { readonly selectionMode?: SelectionMode };
}

export function selectedOf(state: SelectionSlice): readonly string[] {
    return state.selectedItemIds ?? [];
}

export function modeOf(state: SelectionSlice): SelectionMode {
    return state.settings.selectionMode ?? "single";
}

export function anchorOf(state: SelectionSlice): string | null {
    return state.selectionAnchorItemId ?? null;
}

export function draftSlice(draft: Draft): SelectionSlice {
    return draft.state as unknown as SelectionSlice;
}

export function setSelected(draft: Draft, ids: readonly string[]): void {
    draft.setField("selectedItemIds", ids);
}

export function setAnchor(draft: Draft, id: string | null): void {
    draft.setField("selectionAnchorItemId", id);
}
