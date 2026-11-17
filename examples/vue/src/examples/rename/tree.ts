import { typedTree } from "@fragiola/tree-vue";
import { rename } from "@fragiola/tree-vue/rename";
import type { FileTypes } from "../_kit/data";

/** The opt-in features of the model: the rename. */
export const features = [rename()] as const;

export const Tree = typedTree<FileTypes, typeof features>();
