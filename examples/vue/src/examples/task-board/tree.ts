import { typedTree } from "@fragiola/tree-vue";
import type { BoardTypes } from "./board";
import type { BoardFeatures } from "./model";

// The primitives typed by the board's registry and features (a template cannot pass a type argument).
export const Tree = typedTree<BoardTypes, BoardFeatures>();
