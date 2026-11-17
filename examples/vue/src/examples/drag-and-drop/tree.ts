import { typedTree } from "@fragiola/tree-vue";
import { dragAndDrop } from "@fragiola/tree-vue/drag-and-drop";
import { selection } from "@fragiola/tree-vue/selection";
import * as styles from "./styles";

export type Types = { items: { folder: undefined; file: undefined } };

/** The opt-in features of the model: the selection and the drags (a drop line starts past the grip and the toggle). */
export const features = [
    selection(),
    dragAndDrop({ indicatorInset: styles.indicatorInset }),
] as const;

// The primitives typed by Types (a template cannot pass a type argument).
export const Tree = typedTree<Types, typeof features>();
