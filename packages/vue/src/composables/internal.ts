// The composables and helpers only the primitives call.
import type { AnyTypes, CheckState, ItemOf, TreeModel } from "@fragiola/tree";
import { nextTick, onScopeDispose, watch } from "vue";
import type { TreeContextValue } from "../context";
import { dataAttributes, onClient } from "../utils/render";
import type { TreeItemState } from "./use-tree-item";

/**
 * @internal the state of an item of `context`'s tree. Call it in a render or a computed: it reads
 * the context's state, revision and engine, so it is computed again when the tree changes.
 */
export function treeItemState(
    context: TreeContextValue,
    item: ItemOf<AnyTypes>,
): TreeItemState {
    const { model } = context;
    const state = context.state.value;
    context.revision.value;
    const engine = context.engine.value;
    const itemId = item.id;
    const path = model.get("item-path-by", { itemId }) ?? "";
    const segments = path.split("/").filter((segment) => segment !== "");
    const parent = model.get("item-parent-by", { itemId });
    const siblings =
        parent === undefined
            ? state.rootItemIds.length
            : (parent.childItemIds?.length ?? 0);
    // the mixed state walks the item's subtree: only a tree with checkboxes pays for it
    const checkState: CheckState = context.checkboxes.value
        ? model.get("check-state-by", { itemId })
        : model.is("item-checked", { itemId })
          ? "checked"
          : "unchecked";
    const status = item.childrenStatus;
    const dropTarget = engine?.is("item-drop-target", { itemId }) ?? false;
    return {
        itemId,
        path,
        level: Math.max(1, segments.length),
        posinset: Number(segments.at(-1) ?? 0) + 1,
        setsize: siblings,
        expanded: model.is("item-expanded", { itemId }),
        selected: model.is("item-selected", { itemId }),
        focused: model.is("item-focused", { itemId }),
        tabStop: context.tabStopItemId.value === itemId,
        checkState,
        checked: checkState === "checked",
        indeterminate: checkState === "mixed",
        renaming: state.renamingItemId === itemId,
        loading: status === "loading",
        loadError: status === "error",
        disabled: item.disabled === true,
        leaf: model.is("item-leaf", { itemId }),
        dragging: engine?.is("item-dragging", { itemId }) ?? false,
        dropTarget,
        dropPosition: dropTarget
            ? engine?.get("drop-target")?.position
            : undefined,
    };
}

/** @internal the `data-*` attributes every part of an item carries */
export function itemDataAttributes(state: TreeItemState) {
    return dataAttributes({
        expanded: state.expanded,
        selected: state.selected,
        focused: state.focused,
        checked: state.checked,
        indeterminate: state.indeterminate,
        renaming: state.renaming,
        loading: state.loading,
        "load-error": state.loadError,
        disabled: state.disabled,
        leaf: state.leaf,
        dragging: state.dragging,
        "drop-target": state.dropTarget,
        "drop-position": state.dropPosition,
        depth: state.level - 1,
    });
}

/** @internal the structural style of an item's parts: the depth, for the indentation */
export function depthStyle(state: TreeItemState): Record<string, string> {
    return { "--tree-depth": String(state.level - 1) };
}

/** The `meta` of the commands that bring the model to the controlled props. */
export const CONTROLLED_META = Object.freeze({ source: "controlled" });

/** @internal the controlled props of `Tree.Root` (`v-model:expanded-item-ids`, …) */
export interface ControlledProps {
    expandedItemIds?: readonly string[] | undefined;
    selectedItemIds?: readonly string[] | undefined;
    checkedItemIds?: readonly string[] | undefined;
}

/** @internal the events that report a change of a controlled list */
export type ControlledEvent =
    | "update:expandedItemIds"
    | "update:selectedItemIds"
    | "update:checkedItemIds";

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

/** The commands that bring the model's state to the controlled props. */
function sync(model: TreeModel, props: ControlledProps): void {
    const { state } = model;
    if (
        props.expandedItemIds !== undefined &&
        !sameSet(props.expandedItemIds, state.expandedItemIds)
    ) {
        const wanted = new Set(props.expandedItemIds);
        const now = new Set(state.expandedItemIds);
        runAll(model, [
            ...state.expandedItemIds
                .filter((itemId) => !wanted.has(itemId))
                .map((itemId) => ({
                    command: "item.collapse",
                    payload: { itemId },
                })),
            ...props.expandedItemIds
                .filter((itemId) => !now.has(itemId))
                .map((itemId) => ({
                    command: "item.expand",
                    payload: { itemId },
                })),
        ]);
    }
    if (props.selectedItemIds !== undefined) {
        // an id the tree does not have (removed, not loaded yet) cannot be selected
        const itemIds = props.selectedItemIds.filter(
            (id) => model.get("item-by", { id }) !== undefined,
        );
        if (!sameSet(itemIds, model.state.selectedItemIds)) {
            model.run("tree.select", { itemIds }, { meta: CONTROLLED_META });
        }
    }
    if (
        props.checkedItemIds !== undefined &&
        !sameSet(props.checkedItemIds, model.state.checkedItemIds)
    ) {
        const wanted = new Set(props.checkedItemIds);
        const now = new Set(model.state.checkedItemIds);
        // unchecks first: unchecking a parent (cascade) must not undo a check of its children
        runAll(model, [
            ...model.state.checkedItemIds
                .filter((itemId) => !wanted.has(itemId))
                .map((itemId) => ({
                    command: "item.check",
                    payload: { itemId, checked: false },
                })),
            ...props.checkedItemIds
                .filter((itemId) => !now.has(itemId))
                .map((itemId) => ({
                    command: "item.check",
                    payload: { itemId, checked: true },
                })),
        ]);
    }
}

/** The controlled lists, by value: what decides whether the model must be brought to them. */
function controlledKey(props: ControlledProps): string {
    const sorted = (ids: readonly string[] | undefined) =>
        ids === undefined ? null : [...ids].sort();
    return JSON.stringify([
        sorted(props.expandedItemIds),
        sorted(props.selectedItemIds),
        sorted(props.checkedItemIds),
    ]);
}

/**
 * @internal controlled and uncontrolled state, through commands (as packages/react's
 * `useControlledState`): a controlled prop that differs from the model runs the commands that
 * bring the model to it (marked `meta.source: "controlled"`); every other commit that changes one
 * of the three lists emits its `update:*` event with the new list. A controlled prop the app does
 * not update reverts the change.
 *
 * The model is brought to the props before the root mounts, once per change of their value,
 * and once after each commit of its own, when the app has had its flush to answer the event: what
 * the model then makes of them (a cascade checks a parent's children, an unknown id is dropped) is
 * settled, never fought over.
 */
export function useControlledState(
    model: TreeModel,
    props: ControlledProps,
    emit: (event: ControlledEvent, itemIds: string[]) => void,
): void {
    let pending = false;
    let stopped = false;
    watch(
        () => controlledKey(props),
        () => sync(model, props),
    );
    // on the client only, as React's layout effects: a server render neither changes a model
    // that may be shared by other requests, nor subscribes to it
    onClient(() => {
        sync(model, props);
        onScopeDispose(() => {
            stopped = true;
        });
        onScopeDispose(
            model.subscribe((event) => {
                if (event.meta?.source === CONTROLLED_META.source) return;
                const { before, after } = event;
                if (!sameSet(before.expandedItemIds, after.expandedItemIds)) {
                    emit("update:expandedItemIds", [...after.expandedItemIds]);
                }
                if (!sameSet(before.selectedItemIds, after.selectedItemIds)) {
                    emit("update:selectedItemIds", [...after.selectedItemIds]);
                }
                if (!sameSet(before.checkedItemIds, after.checkedItemIds)) {
                    emit("update:checkedItemIds", [...after.checkedItemIds]);
                }
                // once the app's answer (a new prop value, or none) has reached the root
                if (pending) return;
                pending = true;
                void nextTick(() => {
                    pending = false;
                    if (!stopped) sync(model, props);
                });
            }),
        );
    });
}
