import type { TreeModel } from "@fragiola/tree-vue";
import { dragAndDrop } from "@fragiola/tree-vue/drag-and-drop";
import { selection } from "@fragiola/tree-vue/selection";
import { typeAhead } from "@fragiola/tree-vue/type-ahead";
import { virtualization } from "@fragiola/tree-vue/virtualization";
import { indicatorInset } from "./styles";
import type { WarehouseTypes } from "./warehouse";

/**
 * The opt-in features of the model: one location selected at a time, a virtualized list (a few
 * thousand rows, measured), type-to-find and the drags (a drop line starts at the icon).
 */
export const features = [
    selection(),
    virtualization({ estimateRowSize: 28, overscan: 10 }),
    typeAhead(),
    dragAndDrop({ indicatorInset }),
] as const;

/** The warehouse's model, with its features. */
export type WarehouseModel = TreeModel<WarehouseTypes, typeof features>;
