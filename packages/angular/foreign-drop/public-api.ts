// The entry of @fragiola/tree-angular/foreign-drop: the core's `foreignDrop()` feature, and the
// `TreeDropIndicatorDirective` that shows its target (a tree may take files without dragging its
// items). A tree that never imports it does not ship them.

export * from "@fragiola/tree/foreign-drop";
export {
    type DropIndicatorState,
    TreeDropIndicatorDirective,
} from "@fragiola/tree-angular/drag-and-drop";
