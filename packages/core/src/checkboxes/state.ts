// Tri-state checkboxes. In `cascade` mode `checkedItemIds` is kept consistent: checking an item
// checks its descendants, and a parent with children is checked exactly when all its children are
// (so `mixed` is derived, never stored). A parent whose children are not loaded keeps its own
// state, and its children inherit it when they load. In `independent` mode each item is on its own.
import type { Draft } from "../state/draft";
import { descendantsOf, itemOf, parentOf } from "../state/structure";
import type { CheckMode, CheckState, TreeState } from "../state/types";

/** What `checkboxes()` adds to the state. */
export interface CheckboxesState {
    /**
     * the checked items; in `cascade` mode a parent with children is in it exactly when all its
     * children are
     */
    readonly checkedItemIds: readonly string[];
    readonly settings: CheckboxesSettings;
}

/** What `checkboxes()` adds to the settings. */
export interface CheckboxesSettings {
    /** how checkboxes relate: `cascade` (the default) or `independent` */
    readonly checkMode: CheckMode;
}

/** The checks as a state holds them (a model without `checkboxes()` has none). */
interface CheckSlice {
    readonly checkedItemIds?: readonly string[];
    readonly settings: { readonly checkMode?: CheckMode };
}

const slice = (state: TreeState) => state as unknown as CheckSlice;

/** The checked items, in the order they were checked. */
export function checkedOf(state: TreeState): readonly string[] {
    return slice(state).checkedItemIds ?? [];
}

/** How the checkboxes relate. */
export function checkModeOf(state: TreeState): CheckMode {
    return slice(state).settings.checkMode ?? "cascade";
}

function setCheckedIds(draft: Draft, ids: readonly string[]): void {
    draft.setField("checkedItemIds", ids);
}

const checkedCache = new WeakMap<TreeState, ReadonlySet<string>>();

/** The checked items, as a set. */
export function checkedSet(state: TreeState): ReadonlySet<string> {
    let set = checkedCache.get(state);
    if (set === undefined) {
        set = new Set(checkedOf(state));
        checkedCache.set(state, set);
    }
    return set;
}

/** An item's checkbox: `mixed` when, in cascade mode, only some of its descendants are checked. */
export function checkStateOf(state: TreeState, itemId: string): CheckState {
    const checked = checkedSet(state);
    if (checked.has(itemId)) return "checked";
    if (checkModeOf(state) === "independent") return "unchecked";
    return descendantsOf(state, itemId).some((id) => checked.has(id))
        ? "mixed"
        : "unchecked";
}

/** The checked list with `add` added and `remove` removed, in a stable order (existing first). */
function withChecks(
    state: TreeState,
    add: ReadonlySet<string>,
    remove: ReadonlySet<string>,
): readonly string[] {
    const kept = checkedOf(state).filter((id) => !remove.has(id));
    const present = new Set(kept);
    return [...kept, ...[...add].filter((id) => !present.has(id))];
}

/**
 * Recomputes the cascade state of `parentItemId` and its ancestors from their children: a parent
 * with children is checked exactly when all of them are.
 */
/** Items left the tree: the checked list forgets them. */
export function forgetChecks(draft: Draft, removed: ReadonlySet<string>): void {
    const checked = checkedOf(draft.state);
    const kept = checked.filter((id) => !removed.has(id));
    if (kept.length !== checked.length) setCheckedIds(draft, kept);
}

export function settleAncestors(
    draft: Draft,
    parentItemId: string | null | undefined,
): void {
    if (checkModeOf(draft.state) !== "cascade") return;
    for (
        let id = parentItemId;
        typeof id === "string";
        id = parentOf(draft.state, id)
    ) {
        const children = itemOf(draft.state, id)?.childItemIds ?? [];
        if (children.length === 0) continue;
        const checked = checkedSet(draft.state);
        const all = children.every((child) => checked.has(child));
        if (all === checked.has(id)) continue;
        const one = new Set([id]);
        setCheckedIds(
            draft,
            all
                ? withChecks(draft.state, one, new Set())
                : withChecks(draft.state, new Set(), one),
        );
    }
}

/**
 * Checks or unchecks an item: in cascade mode its descendants follow and its ancestors are
 * recomputed; in independent mode only the item changes.
 */
export function setChecked(
    draft: Draft,
    itemId: string,
    checked: boolean,
): void {
    const cascade = checkModeOf(draft.state) === "cascade";
    const ids = new Set([
        itemId,
        ...(cascade ? descendantsOf(draft.state, itemId) : []),
    ]);
    setCheckedIds(
        draft,
        checked
            ? withChecks(draft.state, ids, new Set())
            : withChecks(draft.state, new Set(), ids),
    );
    if (cascade) settleAncestors(draft, parentOf(draft.state, itemId));
}

/** New children of `parentItemId` inherit its checked state (cascade mode). */
export function inheritCheck(
    draft: Draft,
    parentItemId: string | null,
    childItemIds: readonly string[],
): void {
    if (checkModeOf(draft.state) !== "cascade" || parentItemId === null) return;
    if (!checkedSet(draft.state).has(parentItemId)) return;
    const ids = new Set(
        childItemIds.flatMap((id) => [id, ...descendantsOf(draft.state, id)]),
    );
    setCheckedIds(draft, withChecks(draft.state, ids, new Set()));
}

/**
 * Makes `checkedItemIds` consistent with the cascade rule after a document is loaded: a listed
 * parent checks its descendants, then every parent's state follows its children.
 */
export function normalizeChecks(draft: Draft): void {
    if (checkModeOf(draft.state) !== "cascade") return;
    const listed = [...checkedOf(draft.state)];
    const ids = new Set(
        listed.flatMap((id) => [id, ...descendantsOf(draft.state, id)]),
    );
    setCheckedIds(draft, withChecks(draft.state, ids, new Set()));
    // bottom-up: the deepest parents first
    const parents = Object.values(draft.state.items)
        .filter((item) => (item.childItemIds?.length ?? 0) > 0)
        .map((item) => item.id);
    const depth = (id: string) => {
        let n = 0;
        for (
            let p = parentOf(draft.state, id);
            typeof p === "string";
            p = parentOf(draft.state, p)
        )
            n++;
        return n;
    };
    parents.sort((a, b) => depth(b) - depth(a));
    const checked = new Set(checkedOf(draft.state));
    for (const id of parents) {
        const children = itemOf(draft.state, id)?.childItemIds ?? [];
        if (children.every((child) => checked.has(child))) checked.add(id);
        else checked.delete(id);
    }
    const order = checkedOf(draft.state).filter((id) => checked.has(id));
    const present = new Set(order);
    setCheckedIds(draft, [
        ...order,
        ...[...checked].filter((id) => !present.has(id)),
    ]);
}
