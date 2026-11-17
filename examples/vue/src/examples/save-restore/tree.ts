import { typedTree } from "@fragiola/tree-vue";
import { dragAndDrop } from "@fragiola/tree-vue/drag-and-drop";
import { rename } from "@fragiola/tree-vue/rename";
import { selection } from "@fragiola/tree-vue/selection";
import type { FileTypes } from "../_kit/data";
import * as styles from "./styles";

/** The opt-in features of the model: the selection, the rename (F2) and the drags. */
export const features = [
    selection(),
    rename(),
    dragAndDrop({ indicatorInset: styles.indicatorInset }),
] as const;

export const Tree = typedTree<FileTypes, typeof features>();
