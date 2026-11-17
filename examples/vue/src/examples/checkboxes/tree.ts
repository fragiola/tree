import { typedTree } from "@fragiola/tree-vue";
import { checkboxes } from "@fragiola/tree-vue/checkboxes";
import type { PermissionTypes } from "../_kit/data";

/** The opt-in features of the model: the checks. */
export const features = [checkboxes()] as const;

export const Tree = typedTree<PermissionTypes, typeof features>();
