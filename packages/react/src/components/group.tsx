import type { AnyTypes, ItemOf, TreeTypes } from "@fragiola/tree";
import * as React from "react";
import { useItemContext, useTreeContext } from "../context";
import { depthStyle, itemDataAttributes } from "../hooks/internal";
import type { TreeItemState } from "../hooks/use-tree-item";
import { type DivPrimitiveProps, useRenderElement } from "../utils/use-render";

export interface GroupProps<T extends TreeTypes = AnyTypes>
    extends DivPrimitiveProps<TreeItemState> {
    /** renders a child item: called with each child of the enclosing item, in order */
    children: (item: ItemOf<T>) => React.ReactNode;
    /** render the group while the item is collapsed too, hidden (default false: only when expanded) */
    keepMounted?: boolean | undefined;
}

/**
 * The children of the enclosing `Tree.Item` (`role="group"`), rendered only while the item is
 * expanded (`keepMounted` keeps them, hidden): calls `children` with each child, keyed by its id.
 * Its state is the item's.
 */
export function Group<T extends TreeTypes = AnyTypes>(props: GroupProps<T>) {
    const { keepMounted, ...rest } = props;
    const { item, state } = useItemContext("Group");
    if (!state.expanded && keepMounted !== true) return null;
    return <GroupElement {...rest} state={state} item={item} />;
}

function GroupElement<T extends TreeTypes>(
    props: Omit<GroupProps<T>, "keepMounted"> & {
        state: TreeItemState;
        item: ItemOf<AnyTypes>;
    },
) {
    const { children, state, item, ...rest } = props;
    const { state: treeState } = useTreeContext("Group");
    const childItems = (item.childItemIds ?? []).flatMap((itemId) => {
        const child = treeState.items[itemId];
        return child ? [child] : [];
    });
    return useRenderElement("div", rest, {
        state,
        props: {
            role: "group",
            "data-tree-part": "group",
            ...itemDataAttributes(state),
            children: childItems.map((child) => (
                <React.Fragment key={child.id}>
                    {children(child as unknown as ItemOf<T>)}
                </React.Fragment>
            )),
        },
        style: {
            ...depthStyle(state),
            ...(state.expanded ? {} : { display: "none" }),
        },
    });
}
