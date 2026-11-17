// The whole core, so that a Vue app installs and imports one package. A local export would
// silently shadow a core name of the same spelling: tests/index.test.ts fails on one.
export * from "@fragiola/tree";
export type {
    DropIndicatorProps,
    DropIndicatorSlots,
    DropIndicatorState,
} from "./components/drop-indicator";
export type { GroupProps, GroupSlots } from "./components/group";
export type { ItemProps, ItemSlots } from "./components/item";
export type {
    ItemContentProps,
    ItemContentSlots,
} from "./components/item-content";
export type { ItemsProps, ItemsSlots } from "./components/items";
export type {
    LiveRegionProps,
    LiveRegionSlots,
    LiveRegionState,
} from "./components/live-region";
export type {
    RootEmits,
    RootProps,
    RootSlots,
    RootState,
} from "./components/root";
export type { ToggleProps, ToggleSlots } from "./components/toggle";
export {
    createTreeRef,
    type TreeHandle,
    type TreeRef,
} from "./composables/create-tree-ref";
export { type UseTreeResult, useTree } from "./composables/use-tree";
export {
    type TreeItemElementProps,
    type TreeItemState,
    type UseTreeItemResult,
    useTreeItem,
} from "./composables/use-tree-item";
export {
    type TreeItemRenameProps,
    type TreeItemRenameState,
    type UseTreeItemRenameOptions,
    type UseTreeItemRenameResult,
    useTreeItemRename,
} from "./composables/use-tree-item-rename";
export { useTreeRef } from "./composables/use-tree-ref";
export {
    type UseTreeStateOptions,
    useTreeState,
} from "./composables/use-tree-state";
export * as Tree from "./parts";
export { type TypedTree, typedTree } from "./typed";
export type {
    PrimitiveProps,
    SlotFunction,
    TreeComponent,
} from "./utils/primitive";
export type {
    AsProp,
    ElementRef,
    RenderSlot,
    RenderSlotProps,
} from "./utils/render";
