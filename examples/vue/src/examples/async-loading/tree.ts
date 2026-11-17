import { typedTree } from "@fragiola/tree-vue";
import type { FileTypes } from "../_kit/data";

// The primitives typed by the kit's files: `item.data` narrows to `{ size }` on a file.
export const Tree = typedTree<FileTypes>();
