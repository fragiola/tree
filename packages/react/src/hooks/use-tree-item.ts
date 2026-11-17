import type {
    AnyTypes,
    CheckState,
    DropPosition,
    ItemOf,
    TreeTypes,
} from "@fragiola/tree";
import * as React from "react";
import { useTreeContext } from "../context";
import { selectionModeOf } from "../utils/feature-state";
import type { RenderedProps } from "../utils/use-render";
import { depthStyle, itemDataAttributes, useTreeItemState } from "./internal";

/** What an item shows: its place in the tree and its state. Every part of an item renders it. */
export interface TreeItemState {
    itemId: string;
    /** its position from the root, `/0/2` (its `data-tree-path`) */
    path: string;
    /** 1 for a root item (`aria-level`) */
    level: number;
    /** its 1-based position among its siblings (`aria-posinset`) */
    posinset: number;
    /** how many siblings it has, itself included (`aria-setsize`) */
    setsize: number;
    /** its children are shown */
    expanded: boolean;
    /** it is part of the selection */
    selected: boolean;
    /** it is the focused item (model data: the roving tab stop as stored) */
    focused: boolean;
    /** it is the roving tab stop: the one item with `tabindex` 0 */
    tabStop: boolean;
    /** its checkbox: checked, unchecked or mixed */
    checkState: CheckState;
    /** its checkbox is checked (not mixed) */
    checked: boolean;
    /** its checkbox is mixed: only some of its descendants are checked */
    indeterminate: boolean;
    /** its label is being edited */
    renaming: boolean;
    /** its children are being loaded */
    loading: boolean;
    /** the last load of its children failed */
    loadError: boolean;
    /** focusable, not actionable */
    disabled: boolean;
    /** no children and no children status */
    leaf: boolean;
    /** it is being dragged */
    dragging: boolean;
    /** the drop target of the drag under way is relative to it */
    dropTarget: boolean;
    /** while it is the drop target: where the drop goes (`before`, `after`, `inside`) */
    dropPosition: DropPosition | undefined;
}

/** What `useTreeItem` returns: the item's state, and the props of its element (`role="treeitem"`). */
export interface UseTreeItemResult {
    state: TreeItemState;
    /** spread onto the item's element: ARIA, `data-*`, the roving `tabindex`, focus and its ref */
    props: RenderedProps;
}

/**
 * An item of the enclosing `Tree.Root`: its state, and the props of its element (`role="treeitem"`
 * with `aria-level`, `aria-posinset`, `aria-setsize`, `aria-expanded`, `aria-selected`,
 * `aria-checked`, `aria-disabled`, `aria-busy`, the roving `tabindex`, the `data-*` state, the
 * part and path attributes, its focus handler and the ref that registers it with the engine).
 * `Tree.Item` is this hook on a `div`.
 *
 * ```tsx
 * const { state, props } = useTreeItem(item);
 * return <li {...props}>{state.expanded ? "open" : "closed"}</li>;
 * ```
 */
export function useTreeItem<T extends TreeTypes = AnyTypes>(
    item: ItemOf<T>,
): UseTreeItemResult {
    const context = useTreeContext("Item");
    const { engine, state: treeState, checkboxes } = context;
    const state = useTreeItemState<T>(item);
    const itemId = item.id;
    const ref = React.useCallback(
        (element: HTMLElement | null) => {
            if (!element || !engine) return;
            engine.adapter.registerItem(itemId, element);
            return () => engine.adapter.registerItem(itemId, null);
        },
        [engine, itemId],
    );
    const onFocus = (event: React.FocusEvent<HTMLElement>) => {
        // the item's own element, not a control inside it (the rename input)
        if (event.target === event.currentTarget) {
            engine?.adapter.handleFocus(itemId);
        }
    };
    // a tree that selects: the selection feature, in a mode other than none
    const mode = selectionModeOf(treeState);
    const selectable = mode !== undefined && mode !== "none";
    const props = {
        ref,
        role: "treeitem",
        "aria-level": state.level,
        "aria-posinset": state.posinset,
        "aria-setsize": state.setsize,
        "aria-expanded": state.leaf ? undefined : state.expanded,
        "aria-selected": selectable ? state.selected : undefined,
        "aria-checked": checkboxes
            ? state.indeterminate
                ? "mixed"
                : state.checked
            : undefined,
        "aria-disabled": state.disabled || undefined,
        "aria-busy": state.loading || undefined,
        tabIndex: state.tabStop ? 0 : -1,
        "data-tree-part": "item",
        "data-tree-path": state.path,
        ...itemDataAttributes(state),
        onFocus,
        style: depthStyle(state),
    } as unknown as RenderedProps;
    return { state, props };
}
