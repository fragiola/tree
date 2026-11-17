// The entry of @fragiola/tree-angular/rename: the rename feature (`rename()`, the core's) and the
// directive that wires your own input onto it: `TreeItemRenameDirective` (`input[treeItemRename]`,
// in your component's `imports`). A tree that never imports it does not ship them.

export * from "@fragiola/tree/rename";
export {
    TreeItemRenameDirective,
    type TreeItemRenameState,
} from "./item-rename.directive";
