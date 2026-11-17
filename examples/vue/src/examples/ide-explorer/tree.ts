import { typedTree } from "@fragiola/tree-vue";
import type { ProjectTypes } from "./project";
import type { features } from "./workspace";

// The primitives typed by the project's registry and features (a template cannot pass a type argument).
export const Tree = typedTree<ProjectTypes, typeof features>();
