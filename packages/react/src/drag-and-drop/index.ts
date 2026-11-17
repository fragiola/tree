// The entry of @fragiola/tree-react/drag-and-drop: the drag and drop feature (`dragAndDrop()`, the
// core's) and what shows its target: `DropIndicator`. A tree that never imports it does not ship
// them.

export * from "@fragiola/tree/drag-and-drop";
export {
    DropIndicator,
    type DropIndicatorProps,
    type DropIndicatorState,
} from "./drop-indicator";
