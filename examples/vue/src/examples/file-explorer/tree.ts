import { typedTree } from "@fragiola/tree-vue";
import { selection } from "@fragiola/tree-vue/selection";
import type { FileTypes } from "../_kit/data";

/** The opt-in features of the model: the selection. */
export const features = [selection()] as const;

// The primitives typed by the kit's file system: `item.data` narrows to `{ size }` on a file.
export const Tree = typedTree<FileTypes, typeof features>();
