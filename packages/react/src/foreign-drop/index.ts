// The entry of @fragiola/tree-react/foreign-drop: the core's `foreignDrop()` feature, and the
// `DropIndicator` that shows its target (a tree may take files without dragging its items). A tree
// that never imports it does not ship them.

export * from "@fragiola/tree/foreign-drop";
export {
    DropIndicator,
    type DropIndicatorProps,
    type DropIndicatorState,
} from "../drag-and-drop/drop-indicator";
