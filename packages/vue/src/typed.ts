import type { TreeFeatures, TreeTypes } from "@fragiola/tree";
import type { GroupProps, GroupSlots } from "./components/group";
import type { ItemProps, ItemSlots } from "./components/item";
import type {
    ItemContentProps,
    ItemContentSlots,
} from "./components/item-content";
import type { ItemsProps, ItemsSlots } from "./components/items";
import type {
    LiveRegionProps,
    LiveRegionSlots,
} from "./components/live-region";
import type { RootEmits, RootProps, RootSlots } from "./components/root";
import type { ToggleProps, ToggleSlots } from "./components/toggle";
import * as parts from "./parts";
import type { TreeComponent } from "./utils/primitive";

/**
 * The `Tree` primitives typed by the registry `T` (items and their data in props and slots) and the
 * features `F` (the root's feature props and events: `v-model:selected-item-ids` with
 * `selection()`).
 */
export interface TypedTree<
    T extends TreeTypes,
    F extends TreeFeatures = readonly [],
> {
    Group: TreeComponent<GroupProps, GroupSlots<T>>;
    Item: TreeComponent<ItemProps<T>, ItemSlots>;
    ItemContent: TreeComponent<ItemContentProps, ItemContentSlots>;
    Items: TreeComponent<ItemsProps, ItemsSlots<T>>;
    LiveRegion: TreeComponent<LiveRegionProps, LiveRegionSlots>;
    Root: TreeComponent<RootProps<T, F>, RootSlots, RootEmits<F>>;
    Toggle: TreeComponent<ToggleProps, ToggleSlots>;
}

/**
 * The `Tree` primitives typed by your registry and your features: what React writes as type
 * arguments (`<Tree.Items<Types>>`, `<Tree.Root<Types, typeof features>>`), which a Vue template
 * cannot pass. The same components, typed:
 *
 * ```ts
 * const Tree = typedTree<Types, typeof features>();
 * // <Tree.Items v-slot="{ item }">: item.data narrows on item.kind
 * ```
 */
export function typedTree<
    T extends TreeTypes,
    F extends TreeFeatures = readonly [],
>(): TypedTree<T, F> {
    return parts as unknown as TypedTree<T, F>;
}
