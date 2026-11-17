import { typedTree } from "@fragiola/tree-vue";
import { rename } from "@fragiola/tree-vue/rename";
import { selection } from "@fragiola/tree-vue/selection";
import { typeAhead } from "@fragiola/tree-vue/type-ahead";
import type { FileTypes } from "../_kit/data";

/** The opt-in features of the model: the selection, the rename (F2) and the type-ahead. */
export const features = [selection(), rename(), typeAhead()] as const;

export const Tree = typedTree<FileTypes, typeof features>();
