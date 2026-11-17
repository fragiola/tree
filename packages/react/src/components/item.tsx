import type { AnyTypes, ItemOf, TreeTypes } from "@fragiola/tree";
import * as React from "react";
import { ItemContext } from "../context";
import { type TreeItemState, useTreeItem } from "../hooks/use-tree-item";
import { type DivPrimitiveProps, useRenderElement } from "../utils/use-render";

export interface ItemProps<T extends TreeTypes = AnyTypes>
    extends DivPrimitiveProps<TreeItemState> {
    /** the item, as `Tree.Items` or `Tree.Group` gives it */
    item: ItemOf<T>;
    /** its row (`Tree.ItemContent`) and its group (`Tree.Group`); no text of its own */
    children?: React.ReactNode;
}

/**
 * An item (`role="treeitem"`, the WAI-ARIA APG Tree View): `aria-level`, `aria-posinset`,
 * `aria-setsize`, `aria-expanded` (a parent), `aria-selected` (a tree that selects),
 * `aria-checked` (`checkboxes`), `aria-disabled`, `aria-busy` (loading) and the roving `tabindex`.
 * It is the element DOM focus goes to; its state is in `data-*`, its depth in `--tree-depth`.
 */
export function Item<T extends TreeTypes = AnyTypes>(props: ItemProps<T>) {
    const { item, children, ...rest } = props;
    const { state, props: itemProps } = useTreeItem<T>(item);
    const { ref, style, ...elementProps } = itemProps as typeof itemProps & {
        style: React.CSSProperties;
    };
    const element = useRenderElement("div", rest, {
        state,
        ref,
        props: { ...elementProps, children },
        style,
    });
    const value = React.useMemo(
        () => ({ item: item as unknown as ItemOf<AnyTypes> }),
        [item],
    );
    return <ItemContext.Provider value={value}>{element}</ItemContext.Provider>;
}
