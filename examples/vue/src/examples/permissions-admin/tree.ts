import { typedTree } from "@fragiola/tree-vue";
import type { features } from "./features";
import type { PermissionTypes } from "./permissions";

// The primitives typed by the permissions' registry and features (a template cannot pass a type argument).
export const Tree = typedTree<PermissionTypes, typeof features>();
