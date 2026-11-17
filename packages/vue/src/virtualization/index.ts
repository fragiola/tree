// The entry of @fragiola/tree-vue/virtualization: the virtualization feature
// (`virtualization(options)`, the core's) and what renders it: `VirtualItems` (typed by
// `typedVirtualItems<Types>()`) and `useTreeVirtualWindow`. A tree that never imports it does not
// ship them.

export * from "@fragiola/tree/virtualization";
export { useTreeVirtualWindow } from "./use-tree-virtual-window";
export {
    typedVirtualItems,
    VirtualItems,
    type VirtualItemsProps,
    type VirtualItemsSlots,
} from "./virtual-items";
