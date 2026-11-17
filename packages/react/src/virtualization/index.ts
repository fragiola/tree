// The entry of @fragiola/tree-react/virtualization: the virtualization feature
// (`virtualization(options)`, the core's) and what renders it: `VirtualItems` and
// `useTreeVirtualWindow`. A tree that never imports it does not ship them.

export * from "@fragiola/tree/virtualization";
export { useTreeVirtualWindow } from "./use-tree-virtual-window";
export {
    VirtualItems,
    type VirtualItemsProps,
} from "./virtual-items";
