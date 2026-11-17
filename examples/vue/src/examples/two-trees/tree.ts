import { typedTree } from "@fragiola/tree-vue";
import { dragAndDrop } from "@fragiola/tree-vue/drag-and-drop";
import { dragGroup } from "@fragiola/tree-vue/drag-group";
import { selection } from "@fragiola/tree-vue/selection";
import * as styles from "./styles";

export type Types = { items: { group: undefined; produce: undefined } };

/**
 * The opt-in features of the models: the selection, the drags, and the "lists" drag group (the
 * trees of the document whose models have it share their drags).
 */
export const features = [
    selection(),
    dragAndDrop({ indicatorInset: styles.indicatorInset }),
    dragGroup({ name: "lists" }),
] as const;

// The primitives typed by Types (a template cannot pass a type argument).
export const Tree = typedTree<Types, typeof features>();
