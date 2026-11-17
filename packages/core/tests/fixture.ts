// The documents the tests load. `files()`:
//
//   src/            folder, expanded
//     app.ts
//     lib/          loaded by the app's loader (unloaded)
//     utils/        folder
//       a.ts
//       b.ts
//   readme.md
import {
    type AsyncChildrenFeature,
    asyncChildren,
} from "../src/async-children/async-children";
import {
    type CheckboxesFeature,
    type CheckboxesOptions,
    checkboxes,
} from "../src/checkboxes/checkboxes";
import {
    type DragAndDropFeature,
    type DragAndDropOptions,
    dragAndDrop,
} from "../src/drag-and-drop/drag-and-drop";
import type { TreeFeatures } from "../src/features/types";
import { type RenameFeature, rename } from "../src/rename/rename";
import { type SelectionFeature, selection } from "../src/selection/selection";
import type { TreeJson } from "../src/state/json";
import {
    createTreeModel,
    type TreeModel,
    type TreeModelOptions,
} from "../src/state/model";
import {
    type TypeAheadFeature,
    type TypeAheadOptions,
    typeAhead,
} from "../src/type-ahead/type-ahead";

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
 * `files()` for a model without `asyncChildren()`: `lib` is a parent with no children instead of
 * one the loader fills (a bare document has no `childrenStatus`).
 */
export function bareFiles(
    patch: Partial<TreeJson<FileTypes>> = {},
): TreeJson<FileTypes> {
    const json = files(patch);
    for (const item of Object.values(json.items)) {
        if (item.childrenStatus === undefined) continue;
        delete item.childrenStatus;
        item.childItemIds ??= [];
    }
    return json;
}

/** Every feature but the drag extensions: what a test model installs unless it says otherwise. */
export type AllFeatures = readonly [
    SelectionFeature,
    CheckboxesFeature,
    RenameFeature,
    AsyncChildrenFeature,
    TypeAheadFeature,
    DragAndDropFeature,
];

export function allFeatures(
    options: {
        checkboxes?: CheckboxesOptions;
        typeAhead?: TypeAheadOptions;
        dragAndDrop?: DragAndDropOptions;
    } = {},
): AllFeatures {
    return [
        selection(),
        checkboxes(options.checkboxes),
        rename(),
        asyncChildren(),
        typeAhead(options.typeAhead),
        dragAndDrop(options.dragAndDrop),
    ] as const;
}

/**
 * A model of `files()`, with every feature unless `options.features` says otherwise (`features:
 * []`: a bare tree, of `bareFiles()` when `asyncChildren()` is not installed).
 */
export function filesModel<const F extends TreeFeatures = AllFeatures>(
    patch: Partial<TreeJson<FileTypes>> = {},
    options: TreeModelOptions<FileTypes, F> = {},
): TreeModel<FileTypes, F> {
    const features = (options.features ?? allFeatures()) as TreeFeatures;
    const json = features.some((feature) => feature.name === "async-children")
        ? files(patch)
        : bareFiles(patch);
    return createTreeModel<FileTypes, F>(json, {
        ...options,
        features: features as unknown as F,
    });
}

/** The ids of the visible items, in render order. */
export function visibleIds(model: TreeModel<FileTypes>): string[] {
    return model.get("visible-items").map((entry) => entry.itemId);
}
