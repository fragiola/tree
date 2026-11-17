// The hooks and helpers only the primitives call.
import type { AnyTypes, ItemOf, TreeModel, TreeTypes } from "@fragiola/tree";
import * as React from "react";
import { useTreeContext } from "../context";
import { dataAttributes } from "../utils/use-render";
import type { TreeItemState } from "./use-tree-item";

/** @internal `useLayoutEffect` in a browser, nothing on the server (where it would warn) */
export const useIsomorphicLayoutEffect =
    typeof document === "undefined" ? () => {} : React.useLayoutEffect;

/** @internal the state of an item, read from the enclosing `Tree.Root` */
export function useTreeItemState<T extends TreeTypes = AnyTypes>(
    item: ItemOf<T>,
): TreeItemState {
    const context = useTreeContext("Item");
    const { model, engine, state } = context;
    const itemId = item.id;
    const path = model.get("item-path-by", { itemId }) ?? "";
    const segments = path.split("/").filter((segment) => segment !== "");
    const parent = model.get("item-parent-by", { itemId });
    const siblings =
        parent === undefined
            ? state.rootItemIds.length
            : (parent.childItemIds?.length ?? 0);
    const checkState = model.get("check-state-by", { itemId });
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
        tabStop: context.tabStopItemId === itemId,
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
export function depthStyle(state: TreeItemState): React.CSSProperties {
    return { "--tree-depth": state.level - 1 } as React.CSSProperties;
}

/** The `meta` of the commands that bring the model to the controlled props. */
export const CONTROLLED_META = Object.freeze({ source: "controlled" });

/** @internal the controlled props of `Tree.Root` */
export interface ControlledProps {
    expandedItemIds?: readonly string[] | undefined;
    onExpandedItemIdsChange?: ((itemIds: string[]) => void) | undefined;
    selectedItemIds?: readonly string[] | undefined;
    onSelectedItemIdsChange?: ((itemIds: string[]) => void) | undefined;
    checkedItemIds?: readonly string[] | undefined;
    onCheckedItemIdsChange?: ((itemIds: string[]) => void) | undefined;
}

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
    if (
        props.selectedItemIds !== undefined &&
        !sameSet(props.selectedItemIds, model.state.selectedItemIds)
    ) {
        const itemIds = props.selectedItemIds.filter(
            (id) => model.get("item-by", { id }) !== undefined,
        );
        model.run("tree.select", { itemIds }, { meta: CONTROLLED_META });
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

/**
 * @internal controlled and uncontrolled state, through commands: a controlled prop that differs
 * from the model runs the commands that bring the model to it (before paint, marked
 * `meta.source: "controlled"`); every other commit that changes one of the three lists calls its
 * `on…Change` with the new list. A controlled prop the app does not update reverts the change.
 */
export function useControlledState(
    model: TreeModel,
    props: ControlledProps,
): void {
    const latest = React.useRef(props);
    latest.current = props;
    useIsomorphicLayoutEffect(
        () =>
            model.subscribe((event) => {
                if (event.meta?.source === CONTROLLED_META.source) return;
                const { before, after } = event;
                const current = latest.current;
                if (!sameSet(before.expandedItemIds, after.expandedItemIds)) {
                    current.onExpandedItemIdsChange?.([
                        ...after.expandedItemIds,
                    ]);
                }
                if (!sameSet(before.selectedItemIds, after.selectedItemIds)) {
                    current.onSelectedItemIdsChange?.([
                        ...after.selectedItemIds,
                    ]);
                }
                if (!sameSet(before.checkedItemIds, after.checkedItemIds)) {
                    current.onCheckedItemIdsChange?.([...after.checkedItemIds]);
                }
            }),
        [model],
    );
    // after every render: the props may have changed, or a commit the app did not accept may
    // have to be reverted
    useIsomorphicLayoutEffect(() => {
        sync(model, latest.current);
    });
}
