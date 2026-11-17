import { asyncChildren } from "@fragiola/tree-angular/async-children";

/** The opt-in features of the model: children that come from the app's loader. */
export const features = [asyncChildren()] as const;
