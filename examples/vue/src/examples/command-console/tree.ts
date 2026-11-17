import { typedTree } from "@fragiola/tree-vue";
import type { FileTypes } from "../_kit/data";

// The primitives typed by the kit's file system: `item` in a slot is one of its items.
export const Tree = typedTree<FileTypes>();
