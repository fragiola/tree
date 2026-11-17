import type { AnyTypes, ItemOf, TreeTypes } from "@fragiola/tree";
import * as React from "react";
import { useTreeContext } from "../context";

export interface ItemsProps<T extends TreeTypes = AnyTypes> {
    /** renders a root item: called with each one, in order, as the model holds it (plain, immutable) */
    children: (item: ItemOf<T>) => React.ReactNode;
}

/**
 * The root items: calls `children` with each one, in order, keyed by its id. It renders no element
 * of its own; you own the recursion (`Tree.Group` inside your item renders its children).
 *
 * ```tsx
 * <Tree.Items<Types>>{(item) => <FileItem item={item} />}</Tree.Items>
 * ```
 */
export function Items<T extends TreeTypes = AnyTypes>({
    children,
}: ItemsProps<T>) {
    const { state } = useTreeContext("Items");
    return state.rootItemIds.map((itemId) => {
        const item = state.items[itemId];
        return item ? (
            <React.Fragment key={itemId}>
                {children(item as unknown as ItemOf<T>)}
            </React.Fragment>
        ) : null;
    });
}
