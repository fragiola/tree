import type { Signal } from "@angular/core";
import type { AnyTypes, ItemOf, TreeTypes } from "@fragiola/tree";
import { injectItemContext } from "../context";
import type { TreeItemState } from "../utils/item-state";

export interface InjectTreeItemResult<T extends TreeTypes = AnyTypes> {
    /** the item, as the model holds it */
    item: Signal<ItemOf<T>>;
    /** what it shows: its place in the tree and its state */
    state: Signal<TreeItemState>;
}

/**
 * The enclosing `[treeItem]`'s item and state, for a component inside it (a row's menu, an icon).
 * The directive puts the ARIA, the `data-*` and the listeners on its element. Call it in an
 * injection context.
 */
export function injectTreeItem<
    T extends TreeTypes = AnyTypes,
>(): InjectTreeItemResult<T> {
    const context = injectItemContext("injectTreeItem");
    return {
        item: context.item as unknown as Signal<ItemOf<T>>,
        state: context.state,
    };
}
