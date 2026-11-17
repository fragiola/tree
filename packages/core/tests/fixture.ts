// The documents the tests load. `files()`:
//
//   src/            folder, expanded
//     app.ts
//     lib/          loaded by the app's loader (unloaded)
//     utils/        folder
//       a.ts
//       b.ts
//   readme.md
import type { TreeFeatures } from "../src/features/types";
import { type SelectionFeature, selection } from "../src/selection/selection";
import type { TreeJson } from "../src/state/json";
import {
    createTreeModel,
    type TreeModel,
    type TreeModelOptions,
} from "../src/state/model";

export type FileTypes = {
    items: { folder: undefined; file: { size: number } };
};

export function files(
    patch: Partial<TreeJson<FileTypes>> = {},
): TreeJson<FileTypes> {
    return {
        version: 1,
        rootItemIds: ["src", "readme"],
        items: {
            src: {
                kind: "folder",
                label: "src",
                childItemIds: ["app", "lib", "utils"],
            },
            app: { kind: "file", label: "app.ts", data: { size: 120 } },
            lib: { kind: "folder", label: "lib", childrenStatus: "unloaded" },
            utils: { kind: "folder", label: "utils", childItemIds: ["a", "b"] },
            a: { kind: "file", label: "a.ts", data: { size: 1 } },
            b: { kind: "file", label: "b.ts", data: { size: 2 } },
            readme: { kind: "file", label: "readme.md", data: { size: 3 } },
        },
        expandedItemIds: ["src"],
        ...patch,
    };
}

/**
 * A model of `files()`, with the selection feature unless `options.features` says otherwise
 * (`features: []`: a bare tree).
 */
export function filesModel<
    const F extends TreeFeatures = readonly [SelectionFeature],
>(
    patch: Partial<TreeJson<FileTypes>> = {},
    options: TreeModelOptions<FileTypes, F> = {},
): TreeModel<FileTypes, F> {
    return createTreeModel<FileTypes, F>(files(patch), {
        features: [selection()] as unknown as F,
        ...options,
    });
}

/** The ids of the visible items, in render order. */
export function visibleIds(model: TreeModel<FileTypes>): string[] {
    return model.get("visible-items").map((entry) => entry.itemId);
}
