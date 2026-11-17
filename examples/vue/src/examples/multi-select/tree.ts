import { typedTree } from "@fragiola/tree-vue";
import { selection } from "@fragiola/tree-vue/selection";
import type { OrgTypes } from "../_kit/data";

/** The opt-in features of the model: the selection. */
export const features = [selection()] as const;

// The primitives typed by the kit's organization chart: `item.data` is `{ role }`.
export const Tree = typedTree<OrgTypes, typeof features>();
