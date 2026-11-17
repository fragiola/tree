import { typedTree } from "@fragiola/tree-vue";
import { dragAndDrop } from "@fragiola/tree-vue/drag-and-drop";
import { typeAhead } from "@fragiola/tree-vue/type-ahead";
import { virtualization } from "@fragiola/tree-vue/virtualization";
import * as styles from "./styles";

export type Types = { items: { folder: undefined; file: undefined } };

// The virtualization feature: the engine renders only the rows in view, plus 10 on each side. Each
// theme sizes the rows, so they are measured (estimated at 28px until then).
export const features = [
    virtualization({ estimateRowSize: 28, overscan: 10 }),
    typeAhead(),
    dragAndDrop({ indicatorInset: styles.indicatorInset }),
] as const;

// The primitives typed by Types (a template cannot pass a type argument).
export const Tree = typedTree<Types, typeof features>();
