import type { TreeModel } from "@fragiola/tree-vue";
import { checkboxes } from "@fragiola/tree-vue/checkboxes";
import type { PermissionTypes } from "./permissions";

/** The opt-in features of the model: the checks, in cascade (the document's `checkMode`). */
export const features = [checkboxes()] as const;

/** The permissions' model, with its features. */
export type PermissionModel = TreeModel<PermissionTypes, typeof features>;
