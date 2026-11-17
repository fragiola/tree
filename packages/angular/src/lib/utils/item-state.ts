// The state of an item, as packages/vue's `treeItemState` (composables/internal.ts) computes it,
// and the `data-*` every part of an item carries.

import type {
    AnyTypes,
    CheckState,
    DropPosition,
    ItemOf,
} from "@fragiola/tree";
import type { TreeContext } from "../context";
import { dataAttr } from "./helpers";

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
    /** it is part of the selection (`selection()`) */
    selected: boolean;
    /** it is the focused item (model data: the roving tab stop as stored) */
    focused: boolean;
    /** it is the roving tab stop: the one item with `tabindex` 0 */
    tabStop: boolean;
    /** its check: checked, unchecked or mixed */
    checkState: CheckState;
    /** it is checked (not mixed) */
    checked: boolean;
    /** its check is mixed: only some of its descendants are checked */
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
    /**
     * the ARIA and `data-*` the installed features give it (`selection()`: `aria-selected`,
     * `data-selected`), each a string, `undefined` when absent: its element gets them all, every
     * other part of it the `data-*`
     */
    attributes: Readonly<Record<string, string | undefined>>;
}

const NO_ATTRIBUTES: Readonly<Record<string, string | undefined>> =
    Object.freeze({});

/** An item's state before its input is set (see `beforeInputs`). */
export const UNSET_ITEM_STATE: TreeItemState = Object.freeze({
    itemId: "",
    path: "",
    level: 1,
    posinset: 1,
    setsize: 1,
    expanded: false,
    selected: false,
    focused: false,
    tabStop: false,
    checkState: "unchecked",
    checked: false,
    indeterminate: false,
    renaming: false,
    loading: false,
    loadError: false,
    disabled: false,
    leaf: true,
    dragging: false,
    dropTarget: false,
    dropPosition: undefined,
    attributes: NO_ATTRIBUTES,
});

/**
 * The state of an item of `context`'s tree. Call it in a computed: it reads the context's state,
 * revision and engine, so it is computed again when the tree changes.
 */
export function treeItemState(
    context: TreeContext,
    item: ItemOf<AnyTypes>,
): TreeItemState {
    const model = context.model();
    const state = context.state();
    context.revision();
    const engine = context.engine();
    const itemId = item.id;
    const path = model.get("item-path-by", { itemId }) ?? "";
    const segments = path.split("/").filter((segment) => segment !== "");
    const parent = model.get("item-parent-by", { itemId });
    const siblings =
        parent === undefined
            ? state.rootItemIds.length
            : (parent.childItemIds?.length ?? 0);
    // the mixed state walks the item's subtree: only a tree with checkboxes pays for it
    const checkState: CheckState = context.checkboxes()
        ? model.get("check-state-by", { itemId })
        : model.is("item-checked", { itemId })
          ? "checked"
          : "unchecked";
    const status = item.childrenStatus;
    const dropTarget = engine?.is("item-drop-target", { itemId }) ?? false;
    // the features' ARIA and data-*: model state, so the first render (and a server's) has them
    const attributes = model.get("item-attributes-by", { itemId });
    return {
        itemId,
        path,
        level: Math.max(1, segments.length),
        posinset: Number(segments.at(-1) ?? 0) + 1,
        setsize: siblings,
        expanded: model.is("item-expanded", { itemId }),
        selected: attributes["aria-selected"] === "true",
        focused: model.is("item-focused", { itemId }),
        tabStop: context.tabStopItemId() === itemId,
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
        attributes,
    };
}

/**
 * The `data-*` values every part of an item carries, for {@link ITEM_DATA_HOST} (the features'
 * are bound by `bindFeatureAttributes`).
 */
export interface ItemData {
    expanded: string | null;
    focused: string | null;
    checked: string | null;
    indeterminate: string | null;
    renaming: string | null;
    loading: string | null;
    loadError: string | null;
    disabled: string | null;
    leaf: string | null;
    dragging: string | null;
    dropTarget: string | null;
    dropPosition: string | null;
    depth: string | null;
}

export function itemData(state: TreeItemState): ItemData {
    return {
        expanded: dataAttr(state.expanded),
        focused: dataAttr(state.focused),
        checked: dataAttr(state.checked),
        indeterminate: dataAttr(state.indeterminate),
        renaming: dataAttr(state.renaming),
        loading: dataAttr(state.loading),
        loadError: dataAttr(state.loadError),
        disabled: dataAttr(state.disabled),
        leaf: dataAttr(state.leaf),
        dragging: dataAttr(state.dragging),
        dropTarget: dataAttr(state.dropTarget),
        dropPosition: dataAttr(state.dropPosition),
        depth: dataAttr(state.level - 1),
    };
}

/**
 * The host bindings of the `data-*` every part of an item carries, from the directive's
 * `itemData` (an {@link ItemData} signal).
 */
export const ITEM_DATA_HOST = {
    "[attr.data-expanded]": "itemData().expanded",
    "[attr.data-focused]": "itemData().focused",
    "[attr.data-checked]": "itemData().checked",
    "[attr.data-indeterminate]": "itemData().indeterminate",
    "[attr.data-renaming]": "itemData().renaming",
    "[attr.data-loading]": "itemData().loading",
    "[attr.data-load-error]": "itemData().loadError",
    "[attr.data-disabled]": "itemData().disabled",
    "[attr.data-leaf]": "itemData().leaf",
    "[attr.data-dragging]": "itemData().dragging",
    "[attr.data-drop-target]": "itemData().dropTarget",
    "[attr.data-drop-position]": "itemData().dropPosition",
    "[attr.data-depth]": "itemData().depth",
} as const;

/** The structural style of an item's parts: the depth, for the indentation. */
export function depthStyle(state: TreeItemState): Record<string, string> {
    return { "--tree-depth": String(state.level - 1) };
}
