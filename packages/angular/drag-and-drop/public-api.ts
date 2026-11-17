// The entry of @fragiola/tree-angular/drag-and-drop: the drag and drop feature (`dragAndDrop()`,
// the core's) and what shows its target: `TreeDropIndicatorDirective` (`[treeDropIndicator]`, in
// your component's `imports`). A tree that never imports it does not ship them.

export * from "@fragiola/tree/drag-and-drop";
export {
    type DropIndicatorState,
    TreeDropIndicatorDirective,
} from "./drop-indicator.directive";
