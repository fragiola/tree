import { typedTree } from "@fragiola/tree-vue";
import { selection } from "@fragiola/tree-vue/selection";

export type Types = { items: { folder: undefined; file: undefined } };

/** The opt-in features of the model: the selection. */
export const features = [selection()] as const;

// The primitives typed by Types (a template cannot pass a type argument).
export const Tree = typedTree<Types, typeof features>();
