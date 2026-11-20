import type { TreeModel } from "@fragiola/tree-vue";
import { dragAndDrop } from "@fragiola/tree-vue/drag-and-drop";
import { selection } from "@fragiola/tree-vue/selection";
import { typeAhead } from "@fragiola/tree-vue/type-ahead";
import { indicatorInset } from "./styles";
import type { ControlTypes } from "./warehouse";

/**
 * The opt-in features of the model: one location selected at a time (the scope of the panels),
 * type-to-find and the drags of bins between aisles (a drop line starts at the icon).
 */
export const features = [
    selection(),
    typeAhead(),
    dragAndDrop({ indicatorInset }),
] as const;

/** The control room's model, with its features. */
export type ControlFeaturesModel = TreeModel<ControlTypes, typeof features>;
