// What each opt-in feature owns, by name only: its commands, its `get` / `is` keys on the model and
// the engine, its document fields and settings. The core reads this table to refuse what belongs to
// a feature that is not installed (a `not_found` result, a document issue) and to type the verbs
// from the installed features; the code of a feature lives only in its own entry
// (`@fragiola/tree/<feature>`), which nothing in the main entry imports.

/** Every feature's keys and fields. */
export const FEATURE_KEYS = Object.freeze({
    selection: {
        commands: [
            "item.select",
            "tree.select",
            "tree.select-all",
            "tree.clear-selection",
        ],
        get: ["selected-items"],
        is: ["item-selected"],
        engineRun: [],
        engineGet: [],
        engineIs: [],
        fields: ["selectedItemIds", "selectionAnchorItemId"],
        itemFields: [],
        settings: ["selectionMode"],
        rootProps: ["selectedItemIds", "onSelectedItemIdsChange"],
    },
    virtualization: {
        commands: [],
        get: [],
        is: [],
        engineRun: [],
        engineGet: ["virtual-window"],
        engineIs: [],
        fields: [],
        itemFields: [],
        settings: [],
        rootProps: [],
    },
    checkboxes: {
        commands: ["item.check", "item.toggle-check"],
        get: ["check-state-by"],
        is: ["item-checked"],
        engineRun: [],
        engineGet: [],
        engineIs: [],
        fields: ["checkedItemIds"],
        itemFields: [],
        settings: ["checkMode"],
        rootProps: ["checkedItemIds", "onCheckedItemIdsChange"],
    },
    rename: {
        commands: ["item.start-rename", "item.rename", "item.cancel-rename"],
        get: [],
        is: ["item-renaming", "item-renamable"],
        engineRun: ["commit-rename", "cancel-rename"],
        engineGet: [],
        engineIs: [],
        fields: ["renamingItemId"],
        itemFields: ["renamable"],
        settings: ["renamable"],
        rootProps: [],
    },
    "async-children": {
        commands: [
            "item.set-children-status",
            "item.set-children",
            "item.reset-children",
        ],
        get: ["children-status-by"],
        is: ["item-loading"],
        engineRun: ["load-children"],
        engineGet: [],
        engineIs: [],
        fields: [],
        itemFields: ["childrenStatus"],
        settings: [],
        rootProps: ["loadChildren"],
    },
    "type-ahead": {
        commands: [],
        get: ["type-ahead-match"],
        is: [],
        engineRun: [],
        engineGet: [],
        engineIs: [],
        fields: [],
        itemFields: [],
        settings: [],
        rootProps: [],
    },
} as const);

/** The name of an opt-in feature (`@fragiola/tree/<name>`). */
export type FeatureName = keyof typeof FEATURE_KEYS;

/** The kinds of names a feature owns. */
export type FeatureKeyKind = keyof (typeof FEATURE_KEYS)[FeatureName];

/** The names of kind `K` the features `N` own. */
export type OwnedBy<
    K extends FeatureKeyKind,
    N extends FeatureName = FeatureName,
> = N extends FeatureName ? (typeof FEATURE_KEYS)[N][K][number] : never;

const owners = new Map<string, FeatureName>();
for (const [name, keys] of Object.entries(FEATURE_KEYS) as [
    FeatureName,
    (typeof FEATURE_KEYS)[FeatureName],
][]) {
    for (const [kind, list] of Object.entries(keys)) {
        for (const key of list as readonly string[])
            owners.set(`${kind}:${key}`, name);
    }
}

/**
 * Every root prop a feature ships (`selectedItemIds`, `onSelectedItemIdsChange`), with its feature:
 * an adapter keeps them off the root's element, and warns when one is given without its feature.
 */
export const FEATURE_ROOT_PROPS: Readonly<Record<string, FeatureName>> =
    Object.freeze(
        Object.fromEntries(
            (
                Object.entries(FEATURE_KEYS) as [
                    FeatureName,
                    (typeof FEATURE_KEYS)[FeatureName],
                ][]
            ).flatMap(([name, keys]) =>
                keys.rootProps.map((prop) => [prop, name] as const),
            ),
        ),
    );

/** The feature that owns `key` of kind `kind`, if one does. */
export function ownerOf(
    kind: FeatureKeyKind,
    key: string,
): FeatureName | undefined {
    return owners.get(`${kind}:${key}`);
}
