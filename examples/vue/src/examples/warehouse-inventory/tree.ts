import { typedTree } from "@fragiola/tree-vue";
import { typedVirtualItems } from "@fragiola/tree-vue/virtualization";
import type { features } from "./features";
import type { WarehouseTypes } from "./warehouse";

// The primitives typed by the warehouse's registry and features (a template cannot pass a type
// argument), and the rows of the virtualized tree.
export const Tree = typedTree<WarehouseTypes, typeof features>();
export const VirtualItems = typedVirtualItems<WarehouseTypes>();
