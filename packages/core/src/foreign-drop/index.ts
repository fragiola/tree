// The entry of @fragiola/tree/foreign-drop: files, links and text dropped on the tree.

export type { DropPosition, DropTarget } from "../drop-target/drop-evaluation";
export type { DropTuning } from "../drop-target/host";
export {
    type ForeignDrag,
    type ForeignDrop,
    type ForeignDropFeature,
    type ForeignDropOptions,
    foreignDrop,
} from "./foreign-drop";
