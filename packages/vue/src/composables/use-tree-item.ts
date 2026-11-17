import type {
    AnyTypes,
    CheckState,
    DropPosition,
    ItemOf,
    TreeTypes,
} from "@fragiola/tree";
import {
    type ComputedRef,
    computed,
    type MaybeRefOrGetter,
    toValue,
} from "vue";
import { useTreeContext } from "../context";
import { selectionModeOf } from "../utils/feature-state";
import { registerElement } from "../utils/registration";
import { type ElementRef, elementRef } from "../utils/render";
import { depthStyle, itemDataAttributes, treeItemState } from "./internal";

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

/** The props of an item's element: ARIA, `data-*`, the roving `tabindex`, focus and its ref. */
export interface TreeItemElementProps {
    /** the function template ref that registers the element with the engine */
    ref: ElementRef;
    role: "treeitem";
    "aria-level": number;
    "aria-posinset": number;
    "aria-setsize": number;
    "aria-expanded": boolean | undefined;
    "aria-selected": boolean | undefined;
    "aria-checked": boolean | "mixed" | undefined;
    "aria-disabled": true | undefined;
    "aria-busy": true | undefined;
    tabindex: 0 | -1;
    "data-tree-part": "item";
    "data-tree-path": string;
    /** makes the item the focused item when DOM focus enters it */
    onFocus: (event: FocusEvent) => void;
    /** `--tree-depth`, for the indentation */
    style: Record<string, string>;
    [dataAttribute: `data-${string}`]: string | undefined;
}

/** What `useTreeItem` returns: the item's state, and the props of its element (`role="treeitem"`). */
export interface UseTreeItemResult {
    state: ComputedRef<TreeItemState>;
    /** bind onto the item's element (`v-bind="props"`) */
    props: ComputedRef<TreeItemElementProps>;
}

/**
 * An item of the enclosing `Tree.Root`: its state, and the props of its element (`role="treeitem"`
 * with `aria-level`, `aria-posinset`, `aria-setsize`, `aria-expanded`, `aria-selected`,
 * `aria-checked`, `aria-disabled`, `aria-busy`, the roving `tabindex`, the `data-*` state, the
 * part and path attributes, its focus listener and the template ref that registers it with the
 * engine). `Tree.Item` is this composable on a `div`. Call it in `setup`, with the item (a value,
 * a ref or a getter).
 *
 * ```ts
 * const { state, props } = useTreeItem(() => props.item);
 * // <li v-bind="props">{{ state.expanded ? "open" : "closed" }}</li>
 * ```
 */
export function useTreeItem<T extends TreeTypes = AnyTypes>(
    item: MaybeRefOrGetter<ItemOf<T>>,
): UseTreeItemResult {
    const context = useTreeContext("Item");
    const current = () => toValue(item) as unknown as ItemOf<AnyTypes>;
    const state = computed(() => treeItemState(context, current()));
    const ref = elementRef(
        (element) => {
            const engine = context.engine.value;
            if (!engine) return undefined;
            const itemId = current().id;
            return registerElement(
                engine,
                `item:${itemId}`,
                element,
                (registered) => engine.adapter.registerItem(itemId, registered),
            );
        },
        () => [context.engine.value, current().id],
    );
    const onFocus = (event: FocusEvent) => {
        // the item's own element, not a control inside it (a rename editor)
        if (event.target === event.currentTarget) {
            context.engine.value?.adapter.handleFocus(current().id);
        }
    };
    const props = computed<TreeItemElementProps>(() => {
        const value = state.value;
        // a tree that selects: the selection feature, in a mode other than none
        const mode = selectionModeOf(context.state.value);
        const selectable = mode !== undefined && mode !== "none";
        return {
            ref,
            role: "treeitem",
            "aria-level": value.level,
            "aria-posinset": value.posinset,
            "aria-setsize": value.setsize,
            "aria-expanded": value.leaf ? undefined : value.expanded,
            "aria-selected": selectable ? value.selected : undefined,
            "aria-checked": context.checkboxes.value
                ? value.indeterminate
                    ? "mixed"
                    : value.checked
                : undefined,
            "aria-disabled": value.disabled || undefined,
            "aria-busy": value.loading || undefined,
            tabindex: value.tabStop ? 0 : -1,
            "data-tree-part": "item",
            "data-tree-path": value.path,
            ...itemDataAttributes(value),
            onFocus,
            style: depthStyle(value),
        };
    });
    return { state, props };
}
