import { typedTree } from "@fragiola/tree-vue";
import type { features } from "./features";
import type { ControlTypes } from "./warehouse";

// The primitives typed by the control room's registry and features (a template cannot pass a
// type argument).
export const Tree = typedTree<ControlTypes, typeof features>();
