// The entry of @fragiola/tree-angular/virtualization: the virtualization feature
// (`virtualization(options)`, the core's) and what renders it: `TreeVirtualItemsDirective`
// (`ng-template[treeVirtualItems]`, in your component's `imports`) and `injectTreeVirtualWindow`.
// A tree that never imports it does not ship them.

export * from "@fragiola/tree/virtualization";
export { injectTreeVirtualWindow } from "./inject-tree-virtual-window";
export {
    type TreeVirtualItemsContext,
    TreeVirtualItemsDirective,
} from "./virtual-items.directive";
