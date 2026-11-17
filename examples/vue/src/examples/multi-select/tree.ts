import { typedTree } from "@fragiola/tree-vue";
import type { OrgTypes } from "../_kit/data";

// The primitives typed by the kit's organization chart: `item.data` is `{ role }`.
export const Tree = typedTree<OrgTypes>();
