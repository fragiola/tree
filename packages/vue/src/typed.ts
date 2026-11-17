import type { TreeTypes } from "@fragiola/tree";
import type {
    DropIndicatorProps,
    DropIndicatorSlots,
} from "./components/drop-indicator";
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
import type {
    VirtualItemsProps,
    VirtualItemsSlots,
} from "./components/virtual-items";
import * as parts from "./parts";
import type { TreeComponent } from "./utils/primitive";

/** The `Tree` primitives typed by the registry `T`: items and their data in props and slots. */
export interface TypedTree<T extends TreeTypes> {
    DropIndicator: TreeComponent<DropIndicatorProps, DropIndicatorSlots>;
    Group: TreeComponent<GroupProps, GroupSlots<T>>;
    Item: TreeComponent<ItemProps<T>, ItemSlots>;
    ItemContent: TreeComponent<ItemContentProps, ItemContentSlots>;
    Items: TreeComponent<ItemsProps, ItemsSlots<T>>;
    LiveRegion: TreeComponent<LiveRegionProps, LiveRegionSlots>;
    Root: TreeComponent<RootProps<T>, RootSlots, RootEmits>;
    Toggle: TreeComponent<ToggleProps, ToggleSlots>;
    VirtualItems: TreeComponent<VirtualItemsProps, VirtualItemsSlots<T>>;
}

/**
 * The `Tree` primitives typed by your registry: what React writes as a type argument
 * (`<Tree.Items<Types>>`), which a Vue template cannot pass. The same components, typed:
 *
 * ```ts
 * const Tree = typedTree<Types>();
 * // <Tree.Items v-slot="{ item }">: item.data narrows on item.kind
 * ```
 */
export function typedTree<T extends TreeTypes>(): TypedTree<T> {
    return parts as unknown as TypedTree<T>;
}
