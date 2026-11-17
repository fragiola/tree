import { typedTree } from "@fragiola/tree-vue";
import { asyncChildren } from "@fragiola/tree-vue/async-children";
import type { FileTypes } from "../_kit/data";

/** The opt-in features of the model: children that come from the app's loader. */
export const features = [asyncChildren()] as const;

export const Tree = typedTree<FileTypes, typeof features>();
