import { typedTree } from "@fragiola/tree-vue";

export type Types = { items: { group: undefined; produce: undefined } };

// The primitives typed by Types (a template cannot pass a type argument).
export const Tree = typedTree<Types>();
