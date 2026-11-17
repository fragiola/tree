import { typedTree } from "@fragiola/tree-vue";

// What the tree holds: each kind of item and the type of its data.
export type Types = { items: { folder: undefined; file: undefined } };

// The primitives typed by Types (a template cannot pass a type argument): `item` in a slot is an
// item of this tree, and `item.data` narrows on `item.kind`.
export const Tree = typedTree<Types>();
