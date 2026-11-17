import {
    type AnnounceEvent,
    type AnyTypes,
    createTreeEngine,
    createTreeModel,
    type KeyMap,
    type LoadChildren,
    type TreeEngine,
    type TreeJson,
    type TreeModel,
    type TreeTypes,
} from "@fragiola/tree";
import * as React from "react";
import { eraseModel, TreeContext, type TreeContextValue } from "../context";
import { setTreeRef, type TreeRef } from "../hooks/create-tree-ref";
import {
    type ControlledProps,
    useControlledState,
    useIsomorphicLayoutEffect,
} from "../hooks/internal";
import { createEngineFacade } from "../utils/engine-facade";
import {
    type DivPrimitiveProps,
    dataAttributes,
    useRenderElement,
} from "../utils/use-render";

export interface RootState {
    /** the selection mode is `multiple` (`aria-multiselectable`) */
    multiselectable: boolean;
    /** a drag is under way (pointer or keyboard) */
    dragging: boolean;
    /** a keyboard drag is under way */
    keyboardDragging: boolean;
    /** the tree has no item */
    empty: boolean;
}

export interface RootProps<T extends TreeTypes = AnyTypes>
    extends DivPrimitiveProps<RootState> {
    /**
     * the tree model. Its middleware (`model.use`) sees every command the tree runs, and its
     * listeners (`model.subscribe`) every change. A new model identity creates a new engine. Give
     * either `model` or `defaultTree`
     */
    model?: TreeModel<T> | undefined;
    /** the document of a model the root creates and keeps (read once, at mount) */
    defaultTree?: TreeJson<T> | undefined;
    /** controlled expansion: the expanded items (with `onExpandedItemIdsChange`) */
    expandedItemIds?: readonly string[] | undefined;
    /** called with the expanded items after every command that changes them */
    onExpandedItemIdsChange?: ((itemIds: string[]) => void) | undefined;
    /** controlled selection: the selected items (with `onSelectedItemIdsChange`) */
    selectedItemIds?: readonly string[] | undefined;
    /** called with the selection after every command that changes it */
    onSelectedItemIdsChange?: ((itemIds: string[]) => void) | undefined;
    /** controlled checkboxes: the checked items (with `onCheckedItemIdsChange`) */
    checkedItemIds?: readonly string[] | undefined;
    /** called with the checked items after every command that changes them */
    onCheckedItemIdsChange?: ((itemIds: string[]) => void) | undefined;
    /** the app's loader of the children of an item with a `childrenStatus` */
    loadChildren?: LoadChildren<T> | undefined;
    /** the live region's text for a drag step or a failed load (no text is built in) */
    announce?: ((event: AnnounceEvent) => string | undefined) | undefined;
    /** the key bindings, over the defaults (`DEFAULT_KEY_MAP`) */
    keyMap?: Partial<KeyMap> | undefined;
    /** a click on a parent's content also expands or collapses it (default false) */
    expandOnClick?: boolean | undefined;
    /** the items carry `aria-checked`, and Space toggles the focused item's check (default false) */
    checkboxes?: boolean | undefined;
    /** how far (px) a press moves before it is a drag (default 4) */
    dragThreshold?: number | undefined;
    /** how long (ms) a drag hovers a collapsed parent before it expands (default 800) */
    autoExpandDelay?: number | undefined;
    /** the indentation of one level (px), for the drop level at the end of a sublist (default 16) */
    indentation?: number | undefined;
    /** how long (ms) between two typed characters keeps one type-ahead search (default 500) */
    typeAheadTimeout?: number | undefined;
    /** access to the model and the engine from outside the root (`useTreeRef`, `createTreeRef`) */
    treeRef?: TreeRef<T> | undefined;
    children?: React.ReactNode;
}

const noSubscribe = () => () => {};
const noRevision = () => 0;

/**
 * The tree (`role="tree"`): owns the engine of its model, attaches it to the rendered element,
 * forwards the keys to it and re-renders when the tree changes. It renders only its children; no
 * Provider is needed above it.
 */
export function Root<T extends TreeTypes = AnyTypes>(props: RootProps<T>) {
    const {
        model: modelProp,
        defaultTree,
        expandedItemIds,
        onExpandedItemIdsChange,
        selectedItemIds,
        onSelectedItemIdsChange,
        checkedItemIds,
        onCheckedItemIdsChange,
        loadChildren,
        announce,
        keyMap,
        expandOnClick,
        checkboxes,
        dragThreshold,
        autoExpandDelay,
        indentation,
        typeAheadTimeout,
        treeRef,
        children,
        ...rest
    } = props;
    const [ownModel] = React.useState(() =>
        modelProp ? null : createTreeModel<T>(defaultTree),
    );
    const typed = (modelProp ?? ownModel) as TreeModel<T>;
    // the parts below work on the erased registry; the typed surface is their props
    const model = eraseModel(typed);

    // the callbacks are read when called: a new function each render recreates nothing
    const latest = React.useRef({ loadChildren, announce });
    latest.current = { loadChildren, announce };
    const hasLoader = loadChildren !== undefined;
    const keyMapKey = JSON.stringify(keyMap ?? null);

    const [facade] = React.useState(createEngineFacade);
    const [engine, setEngine] = React.useState<TreeEngine | null>(null);
    // the engine is created once mounted, in the commit (StrictMode's second mount creates a new
    // one), so no render ever starts a load or subscribes to the model
    useIsomorphicLayoutEffect(() => {
        const created = createTreeEngine(model, {
            loadChildren: hasLoader
                ? (item, context) => {
                      const load = latest.current.loadChildren as
                          | LoadChildren
                          | undefined;
                      return load
                          ? load(item, context)
                          : Promise.reject(new Error("no loadChildren"));
                  }
                : undefined,
            announce: (event) => latest.current.announce?.(event),
            keyMap,
            expandOnClick,
            checkboxes,
            dragThreshold,
            autoExpandDelay,
            indentation,
            typeAheadTimeout,
            // a remount (StrictMode, a route change) loads what this engine was loading
            resetLoadsOnDestroy: true,
        });
        setEngine(created);
        facade.set(created);
        return () => {
            facade.set(null);
            created.destroy();
        };
    }, [
        model,
        facade,
        hasLoader,
        keyMapKey,
        expandOnClick,
        checkboxes,
        dragThreshold,
        autoExpandDelay,
        indentation,
        typeAheadTimeout,
    ]);
    // a destroyed engine (StrictMode's first mount, a replaced model) is never used again
    const live = engine && engine.adapter.model === model ? engine : null;

    useIsomorphicLayoutEffect(() => {
        if (!treeRef) return;
        setTreeRef(treeRef, {
            model: typed,
            engine: facade.engine as unknown as TreeEngine<T>,
        });
        return () => setTreeRef(treeRef, null);
    }, [treeRef, typed, facade]);

    const controlled: ControlledProps = {
        expandedItemIds,
        onExpandedItemIdsChange,
        selectedItemIds,
        onSelectedItemIdsChange,
        checkedItemIds,
        onCheckedItemIdsChange,
    };
    useControlledState(model, controlled);

    const subscribeModel = React.useCallback(
        (onChange: () => void) => model.subscribe(() => onChange()),
        [model],
    );
    const getState = () => model.state;
    const state = React.useSyncExternalStore(
        subscribeModel,
        getState,
        getState,
    );
    const revision = React.useSyncExternalStore(
        live ? live.adapter.subscribe : noSubscribe,
        live ? live.adapter.getSnapshot : noRevision,
        noRevision,
    );

    const rootRef = React.useCallback(
        (element: HTMLElement | null) => {
            if (!element || !live) return;
            live.adapter.attachRoot(element);
            return () => live.adapter.detachRoot();
        },
        [live],
    );
    const onKeyDown = (event: React.KeyboardEvent<HTMLElement>) => {
        live?.adapter.handleKeyDown(event);
    };

    // biome-ignore lint/correctness/useExhaustiveDependencies: the tab stop is the state's
    const tabStopItemId = React.useMemo(
        () => model.get("tab-stop-item")?.id,
        [model, state],
    );
    const isCheckboxes = checkboxes === true;
    const context = React.useMemo<TreeContextValue>(
        () => ({
            model,
            engine: live,
            publicEngine: facade.engine,
            state,
            revision,
            tabStopItemId,
            checkboxes: isCheckboxes,
        }),
        [model, live, facade, state, revision, tabStopItemId, isCheckboxes],
    );

    const rootState: RootState = {
        multiselectable: state.settings.selectionMode === "multiple",
        dragging: live?.is("dragging") ?? false,
        keyboardDragging: live?.is("keyboard-dragging") ?? false,
        empty: state.rootItemIds.length === 0,
    };
    const element = useRenderElement("div", rest, {
        state: rootState,
        ref: rootRef,
        props: {
            role: "tree",
            "aria-multiselectable": rootState.multiselectable || undefined,
            "data-tree-part": "root",
            ...dataAttributes({
                dragging: rootState.dragging,
                "keyboard-dragging": rootState.keyboardDragging,
                empty: rootState.empty,
            }),
            onKeyDown,
            children,
        },
        // the containing block the drop indicator is positioned in
        style: { position: "relative" },
    });
    return (
        <TreeContext.Provider value={context}>{element}</TreeContext.Provider>
    );
}
