import { typedTree } from "@fragiola/tree-vue";
import type { PermissionTypes } from "../_kit/data";

// The primitives typed by the kit's permissions: a permission's `data` is `{ scope }`.
export const Tree = typedTree<PermissionTypes>();
