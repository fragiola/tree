import { typedTree } from "@fragiola/tree-vue";
import { rename } from "@fragiola/tree-vue/rename";
import { selection } from "@fragiola/tree-vue/selection";
import type { FileTypes } from "../_kit/data";

/** The opt-in features of the model: the selection and the rename (`item.rename`). */
export const features = [selection(), rename()] as const;

export const Tree = typedTree<FileTypes, typeof features>();
