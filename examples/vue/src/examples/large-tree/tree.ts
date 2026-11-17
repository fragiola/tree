import { typedTree } from "@fragiola/tree-vue";
import { virtualization } from "@fragiola/tree-vue/virtualization";

export type Types = { items: { folder: undefined; file: undefined } };

// The virtualization feature: the engine renders only the rows in view, plus 10 on each side. Each
// theme sizes the rows, so they are measured (estimated at 28px until then).
export const features = [
    virtualization({ estimateRowSize: 28, overscan: 10 }),
] as const;

// The primitives typed by Types (a template cannot pass a type argument).
export const Tree = typedTree<Types, typeof features>();
