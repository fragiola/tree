// The entry of @fragiola/tree-vue/rename: the rename feature (`rename()`, the core's) and the part
// composable that wires your own editor onto it: `useTreeItemRename`. A tree that never imports it
// does not ship them.

export * from "@fragiola/tree/rename";
export {
    type TreeItemRenameProps,
    type TreeItemRenameState,
    type UseTreeItemRenameOptions,
    type UseTreeItemRenameResult,
    useTreeItemRename,
} from "./use-tree-item-rename";
