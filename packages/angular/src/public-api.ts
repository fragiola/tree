// The whole core, so that an Angular app installs and imports one package. A local export would
// silently shadow a core name of the same spelling: tests/index.test.ts fails on one.
export * from "@fragiola/tree";
export { TreeCheckboxDirective } from "./lib/directives/checkbox.directive";
export {
    type DropIndicatorState,
    TreeDropIndicatorDirective,
} from "./lib/directives/drop-indicator.directive";
export { TreeGroupDirective } from "./lib/directives/group.directive";
export { TreeItemDirective } from "./lib/directives/item.directive";
export { TreeItemContentDirective } from "./lib/directives/item-content.directive";
export { TreeItemsDirective } from "./lib/directives/items.directive";
export {
    type LiveRegionState,
    TreeLiveRegionDirective,
} from "./lib/directives/live-region.directive";
export {
    type RenameInputState,
    TreeRenameInputDirective,
} from "./lib/directives/rename-input.directive";
export {
    type RootState,
    TreeRootDirective,
} from "./lib/directives/root.directive";
export type {
    TreeItemsContext,
    TypedBy,
} from "./lib/directives/templates.directive";
export { TreeToggleDirective } from "./lib/directives/toggle.directive";
export {
    type InjectTreeResult,
    injectTree,
} from "./lib/inject/inject-tree";
export {
    type InjectTreeItemResult,
    injectTreeItem,
} from "./lib/inject/inject-tree-item";
export {
    type InjectTreeStateOptions,
    injectTreeState,
} from "./lib/inject/inject-tree-state";
export { TREE } from "./lib/tree";
export type { TreeItemState } from "./lib/utils/item-state";
