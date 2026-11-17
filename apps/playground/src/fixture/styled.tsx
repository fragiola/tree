import {
    type ItemOf,
    type RootProps,
    Tree,
    type TreeFeatures,
    type TreeTypes,
} from "@fragiola/tree-react";
import type { ReactNode } from "react";

// The styled tree the scenarios render (palette roles only, as the examples): every primitive,
// the label as text. A scenario passes its root props and, optionally, what a row shows after it.

const ROW =
    "flex h-7 select-none items-center gap-1.5 rounded-sm pe-2 ps-[calc(var(--tree-depth)*1rem+0.25rem)] hover:bg-palette-soft data-selected:bg-palette-line/60 data-drop-target:data-[drop-position=inside]:bg-palette-soft data-dragging:opacity-50 [:focus-visible>&]:ring-2 [:focus-visible>&]:ring-palette-ring [:focus-visible>&]:ring-inset";

function Item<T extends TreeTypes>({
    item,
    after,
}: {
    item: ItemOf<T>;
    after?: ((item: ItemOf<T>) => ReactNode) | undefined;
}) {
    return (
        <Tree.Item item={item} className="outline-none">
            <Tree.ItemContent className={ROW}>
                <Tree.Toggle className="flex size-4 items-center justify-center text-palette-accent/85 data-expanded:rotate-90 data-leaf:invisible data-loading:animate-pulse">
                    <span aria-hidden>▸</span>
                </Tree.Toggle>
                <span className="truncate">{item.label}</span>
                {after?.(item)}
            </Tree.ItemContent>
            <Tree.Group<T>>
                {(child) => <Item item={child} after={after} />}
            </Tree.Group>
        </Tree.Item>
    );
}

export function StyledTree<
    T extends TreeTypes,
    F extends TreeFeatures = readonly [],
>({
    after,
    ...props
}: RootProps<T, F> & { after?: (item: ItemOf<T>) => ReactNode }) {
    return (
        <Tree.Root<T, F>
            aria-label="Files"
            className="palette-raised m-4 min-h-0 flex-1 overflow-auto rounded-md border border-palette-line bg-palette-base p-1 text-sm text-palette-contrast"
            // the rest of the props, the after prop taken out: a generic spread TypeScript cannot narrow
            {...(props as RootProps<T, F>)}
        >
            <Tree.Items<T>>
                {(item) => <Item item={item} after={after} />}
            </Tree.Items>
            <Tree.DropIndicator className="h-0.5 rounded-full bg-palette-contrast/70 data-[drop-position=inside]:h-auto data-[drop-position=inside]:rounded-sm data-[drop-position=inside]:bg-transparent data-[drop-position=inside]:outline-2 data-[drop-position=inside]:outline-palette-ring" />
            <Tree.LiveRegion className="sr-only" />
        </Tree.Root>
    );
}
