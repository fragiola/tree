// Controlled and uncontrolled state through commands, as packages/react's `useControlledState`
// and packages/vue's (composables/internal.ts).

import {
    afterNextRender,
    DestroyRef,
    effect,
    Injector,
    inject,
    type Signal,
    untracked,
} from "@angular/core";
import type { TreeModel } from "@fragiola/tree";
import { selectedIdsOf } from "./feature-state";

/** The `meta` of the commands that bring the model to the controlled inputs. */
export const CONTROLLED_META = Object.freeze({ source: "controlled" });

/** The controlled inputs of `[treeRoot]` (`[(expandedItemIds)]`, …), as values. */
export interface ControlledValues {
    expandedItemIds: readonly string[] | undefined;
    selectedItemIds: readonly string[] | undefined;
    checkedItemIds: readonly string[] | undefined;
}

/** The list a change event reports. */
export type ControlledList = keyof ControlledValues;

function sameSet(a: readonly string[], b: readonly string[]): boolean {
    if (a.length !== b.length) return false;
    const set = new Set(a);
    return b.every((id) => set.has(id));
}

type Entry = { command: string; payload: Record<string, unknown> };

/**
 * Runs `entries` as one batch; when the batch is refused (an id the tree does not have, a disabled
 * item), runs each one the model accepts on its own.
 */
function runAll(model: TreeModel, entries: Entry[]): void {
    if (entries.length === 0) return;
    const options = { meta: CONTROLLED_META };
    const batch = { commands: entries } as never;
    if (model.run("batch", batch, options).ok) return;
    for (const { command, payload } of entries) {
        model.run(command as "item.expand", payload as never, options);
    }
}

/** The commands that bring the model's state to the controlled values. */
export function syncControlled(
    model: TreeModel,
    values: ControlledValues,
): void {
    const { state } = model;
    if (
        values.expandedItemIds !== undefined &&
        !sameSet(values.expandedItemIds, state.expandedItemIds)
    ) {
        const wanted = new Set(values.expandedItemIds);
        const now = new Set(state.expandedItemIds);
        runAll(model, [
            ...state.expandedItemIds
                .filter((itemId) => !wanted.has(itemId))
                .map((itemId) => ({
                    command: "item.collapse",
                    payload: { itemId },
                })),
            ...values.expandedItemIds
                .filter((itemId) => !now.has(itemId))
                .map((itemId) => ({
                    command: "item.expand",
                    payload: { itemId },
                })),
        ]);
    }
    if (values.selectedItemIds !== undefined) {
        // an id the tree does not have (removed, not loaded yet) cannot be selected
        const itemIds = values.selectedItemIds.filter(
            (id) => model.get("item-by", { id }) !== undefined,
        );
        if (!sameSet(itemIds, selectedIdsOf(model.state))) {
            // the selection feature's command: a tree with `selectedItemIds` installs it
            (
                model.run as (
                    command: string,
                    payload: object,
                    options: object,
                ) => unknown
            )("tree.select", { itemIds }, { meta: CONTROLLED_META });
        }
    }
    if (
        values.checkedItemIds !== undefined &&
        !sameSet(values.checkedItemIds, model.state.checkedItemIds)
    ) {
        const wanted = new Set(values.checkedItemIds);
        const now = new Set(model.state.checkedItemIds);
        // unchecks first: unchecking a parent (cascade) must not undo a check of its children
        runAll(model, [
            ...model.state.checkedItemIds
                .filter((itemId) => !wanted.has(itemId))
                .map((itemId) => ({
                    command: "item.check",
                    payload: { itemId, checked: false },
                })),
            ...values.checkedItemIds
                .filter((itemId) => !now.has(itemId))
                .map((itemId) => ({
                    command: "item.check",
                    payload: { itemId, checked: true },
                })),
        ]);
    }
}

/**
 * Controlled and uncontrolled state, through commands: a controlled input that differs from the
 * model runs the commands that bring the model to it (marked `meta.source: "controlled"`); every
 * other commit that changes one of the three lists emits its change output with the new list (so
 * `[(expandedItemIds)]` binds both ways). A controlled input the app does not update reverts the
 * change.
 *
 * The model is brought to the inputs whenever they change, and once after each commit of its own,
 * when the app has had its render to answer the change output: what the model then makes of them
 * (a cascade checks a parent's children, an unknown id is dropped) is settled, never fought over.
 * Call it in an injection context.
 */
export function bindControlledState(
    model: Signal<TreeModel>,
    values: () => ControlledValues,
    emit: (list: ControlledList, itemIds: string[]) => void,
): void {
    const injector = inject(Injector);
    const destroyRef = inject(DestroyRef);
    effect(() => {
        const current = model();
        const wanted = values();
        untracked(() => syncControlled(current, wanted));
    });
    effect((onCleanup) => {
        const current = model();
        let pending = false;
        onCleanup(
            current.subscribe((event) => {
                // the root is being destroyed: its engine's teardown commits (a load it drops goes
                // back to `unloaded`) while this listener is still attached, and the view can no
                // longer emit nor schedule a render
                if (destroyRef.destroyed) return;
                if (event.meta?.source === CONTROLLED_META.source) return;
                const { before, after } = event;
                if (!sameSet(before.expandedItemIds, after.expandedItemIds)) {
                    emit("expandedItemIds", [...after.expandedItemIds]);
                }
                if (!sameSet(selectedIdsOf(before), selectedIdsOf(after))) {
                    emit("selectedItemIds", [...selectedIdsOf(after)]);
                }
                if (!sameSet(before.checkedItemIds, after.checkedItemIds)) {
                    emit("checkedItemIds", [...after.checkedItemIds]);
                }
                // once the app's answer (a new input value, or none) has reached the root
                if (pending) return;
                pending = true;
                afterNextRender(
                    () => {
                        pending = false;
                        if (
                            !destroyRef.destroyed &&
                            untracked(model) === current
                        ) {
                            syncControlled(current, untracked(values));
                        }
                    },
                    { injector },
                );
            }),
        );
    });
}
