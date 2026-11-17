// The hooks and helpers only the primitives call.
import {
    type AnyTypes,
    type CheckState,
    type FeatureModel,
    type FeatureState,
    type ItemOf,
    TREE_ROOT_PROPS,
    type TreeModel,
    type TreeRootProp,
    type TreeTypes,
} from "@fragiola/tree";
import * as React from "react";
import { useTreeContext } from "../context";
import { dataAttributes } from "../utils/use-render";
import type { TreeItemState } from "./use-tree-item";

/** @internal `useLayoutEffect` in a browser, nothing on the server (where it would warn) */
export const useIsomorphicLayoutEffect =
    typeof document === "undefined" ? () => {} : React.useLayoutEffect;

/** @internal the state of an item, read from the enclosing `Tree.Root` */
export function useTreeItemState<T extends TreeTypes = AnyTypes>(
    item: ItemOf<T>,
): TreeItemState {
    const context = useTreeContext("Item");
    const { model, engine, state } = context;
    const itemId = item.id;
    const path = model.get("item-path-by", { itemId }) ?? "";
    const segments = path.split("/").filter((segment) => segment !== "");
    const parent = model.get("item-parent-by", { itemId });
    const siblings =
        parent === undefined
            ? state.rootItemIds.length
            : (parent.childItemIds?.length ?? 0);
    // the mixed state walks the item's subtree: only a tree with checkboxes pays for it
    const checkState: CheckState = context.checkboxes
        ? model.get("check-state-by", { itemId })
        : model.is("item-checked", { itemId })
          ? "checked"
          : "unchecked";
    const status = item.childrenStatus;
    const dropTarget = engine?.is("item-drop-target", { itemId }) ?? false;
    const attributes = engine?.adapter.itemAttributes(itemId) ?? NO_ATTRIBUTES;
    return {
        itemId,
        path,
        level: Math.max(1, segments.length),
        posinset: Number(segments.at(-1) ?? 0) + 1,
        setsize: siblings,
        expanded: model.is("item-expanded", { itemId }),
        selected: attributes["aria-selected"] === "true",
        focused: model.is("item-focused", { itemId }),
        tabStop: context.tabStopItemId === itemId,
        checkState,
        checked: checkState === "checked",
        indeterminate: checkState === "mixed",
        renaming: state.renamingItemId === itemId,
        loading: status === "loading",
        loadError: status === "error",
        disabled: item.disabled === true,
        leaf: model.is("item-leaf", { itemId }),
        dragging: engine?.is("item-dragging", { itemId }) ?? false,
        dropTarget,
        dropPosition: dropTarget
            ? engine?.get("drop-target")?.position
            : undefined,
        attributes,
    };
}

const NO_ATTRIBUTES: Readonly<Record<string, string | undefined>> =
    Object.freeze({});

/** @internal the installed features' `data-*` of an item: every part of it carries them */
export function featureDataAttributes(
    state: TreeItemState,
): Record<string, string | undefined> {
    const data: Record<string, string | undefined> = {};
    for (const [key, value] of Object.entries(state.attributes)) {
        if (key.startsWith("data-")) data[key] = value;
    }
    return data;
}

/** @internal the installed features' ARIA of an item, for its element */
export function featureAriaAttributes(
    attributes: Readonly<Record<string, string | undefined>>,
): Record<string, string | undefined> {
    const aria: Record<string, string | undefined> = {};
    for (const [key, value] of Object.entries(attributes)) {
        if (key.startsWith("aria-")) aria[key] = value;
    }
    return aria;
}

/** @internal the `data-*` attributes every part of an item carries */
export function itemDataAttributes(state: TreeItemState) {
    return {
        ...dataAttributes({
            expanded: state.expanded,
            focused: state.focused,
            checked: state.checked,
            indeterminate: state.indeterminate,
            renaming: state.renaming,
            loading: state.loading,
            "load-error": state.loadError,
            disabled: state.disabled,
            leaf: state.leaf,
            dragging: state.dragging,
            "drop-target": state.dropTarget,
            "drop-position": state.dropPosition,
            depth: state.level - 1,
        }),
        ...featureDataAttributes(state),
    };
}

/** @internal the structural style of an item's parts: the depth, for the indentation */
export function depthStyle(state: TreeItemState): React.CSSProperties {
    return { "--tree-depth": state.level - 1 } as React.CSSProperties;
}

/** The `meta` of the commands that bring the model to the controlled props. */
export const CONTROLLED_META = Object.freeze({ source: "controlled" });

/** @internal the controlled props of `Tree.Root`: the core's and its features', by name */
export type ControlledProps = Readonly<Record<string, unknown>>;

/** The controlled lists of a model: the core's (`TREE_ROOT_PROPS`) and its features'. */
export function rootPropsOf(model: TreeModel): readonly TreeRootProp[] {
    return [
        ...TREE_ROOT_PROPS,
        ...model.get("features").flatMap((feature) => feature.rootProps),
    ];
}

function sameSet(a: readonly string[], b: readonly string[]): boolean {
    if (a.length !== b.length) return false;
    const set = new Set(a);
    return b.every((id) => set.has(id));
}

/** The commands that bring the model's state to the controlled props. */
function sync(
    model: TreeModel,
    rootProps: readonly TreeRootProp[],
    props: ControlledProps,
): void {
    for (const rootProp of rootProps) {
        const value = props[rootProp.prop] as readonly string[] | undefined;
        if (value === undefined) continue;
        rootProp.sync(model as unknown as FeatureModel, value, {
            meta: CONTROLLED_META,
        });
    }
}

/** The controlled lists, by value: what decides whether the model must be brought to them. */
function controlledKey(
    rootProps: readonly TreeRootProp[],
    props: ControlledProps,
): string {
    return JSON.stringify(
        rootProps.map(({ prop }) => {
            const ids = props[prop] as readonly string[] | undefined;
            return ids === undefined ? null : [...ids].sort();
        }),
    );
}

/**
 * @internal controlled and uncontrolled state, through commands: a controlled prop that differs
 * from the model runs the commands that bring the model to it (before paint, marked
 * `meta.source: "controlled"`); every other commit that changes one of the lists calls its
 * `on…Change` with the new list. The lists are the core's (`expandedItemIds`, `checkedItemIds`)
 * and the installed features' (`selectedItemIds` with `selection()`), mapped the same way. A
 * controlled prop the app does not update reverts the change.
 *
 * The model is brought to the props once per change of their value, and once after each commit
 * of its own: what the model then makes of them (a cascade checks a parent's children, an unknown
 * id is dropped) is settled, never fought over render after render.
 */
export function useControlledState(
    model: TreeModel,
    props: ControlledProps,
): void {
    const latest = React.useRef(props);
    latest.current = props;
    const rootProps = React.useMemo(() => rootPropsOf(model), [model]);
    const synced = React.useRef<{ model: TreeModel; key: string } | null>(null);
    const dirty = React.useRef(false);
    useIsomorphicLayoutEffect(
        () =>
            model.subscribe((event) => {
                if (event.meta?.source === CONTROLLED_META.source) return;
                dirty.current = true;
                const before = event.before as FeatureState;
                const after = event.after as FeatureState;
                const current = latest.current;
                for (const { read, changeProp } of rootProps) {
                    const next = read(after);
                    if (sameSet(read(before), next)) continue;
                    const onChange = current[changeProp] as
                        | ((itemIds: string[]) => void)
                        | undefined;
                    onChange?.([...next]);
                }
            }),
        [model, rootProps],
    );
    // after a render where the props changed value, or after a commit the app may not accept
    const key = controlledKey(rootProps, props);
    useIsomorphicLayoutEffect(() => {
        const last = synced.current;
        if (last?.model === model && last.key === key && !dirty.current) return;
        synced.current = { model, key };
        dirty.current = false;
        sync(model, rootProps, latest.current);
    });
}
