import { typedTree } from "@fragiola/tree-vue";
import type { FileTypes } from "../_kit/data";

// The primitives typed by FileTypes (a template cannot pass a type argument).
export const Tree = typedTree<FileTypes>();
